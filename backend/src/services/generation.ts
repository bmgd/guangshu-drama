import { eq, inArray } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { sysTasks, characters, scenes, props, storyboards, assets, episodes, storyboardCharacters } from '../db/schema.js'
import { getActiveConfig, getConfigById } from './ai.js'
import { getImageAdapter, getVideoAdapter, getAudioAdapter } from './adapters/registry.js'
import { saveImageWithThumb, saveBuffer } from '../utils/storage.js'
import { generateVideoPoster } from '../utils/video-poster.js'
import { logTask } from '../utils/task-logger.js'
import { recordUsage } from './usage.js'
import { pushMediaVersion } from './media-versions.js'
import { computeStoryboardFingerprint } from './artifact-status.js'
import {
  appendTaskEvent,
  isTaskCancelled,
  setTaskProgress,
} from './task-events.js'

let pollerStarted = false

const IMAGE_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_CONCURRENCY || 3))
const VIDEO_CONCURRENCY = Math.max(1, Number(process.env.VIDEO_CONCURRENCY || 2))

/** 简易内存信号量：限制同时进行的本地图片生成 */
class Semaphore {
  private active = 0
  private waiters: Array<() => void> = []
  constructor(private readonly max: number) {}
  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++
      return
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve))
    this.active++
  }
  release() {
    this.active = Math.max(0, this.active - 1)
    const next = this.waiters.shift()
    if (next) next()
  }
  get running() {
    return this.active
  }
}

const imageSemaphore = new Semaphore(IMAGE_CONCURRENCY)

export function buildConfigSnapshot(config: {
  provider?: string | null
  model?: string | null
  baseUrl?: string | null
  settings?: string | null
  serviceType?: string | null
}) {
  return JSON.stringify({
    provider: config.provider || null,
    model: config.model || null,
    baseUrl: config.baseUrl || null,
    settings: config.settings || null,
    serviceType: config.serviceType || null,
  })
}

export async function findActiveByIdempotency(key: string) {
  if (!key) return null
  const rows = await db.select().from(sysTasks).where(eq(sysTasks.idempotencyKey, key))
  return rows.find((r) => r.status === 'processing' || r.status === 'pending') || null
}

async function assertStoryboardUnlocked(storyboardId: number) {
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, storyboardId)).limit(1)
  const sb = rows[0]
  if (sb?.locked) throw new Error('分镜已锁定，无法生成')
  return sb
}

async function resolveImageConfig(params: {
  configId?: number
  type: 'character' | 'scene' | 'prop' | 'storyboard'
  targetId: number
}) {
  if (params.configId) {
    const byId = await getConfigById(params.configId)
    if (byId) return byId
  }
  if (params.type === 'storyboard') {
    const sbRows = await db.select().from(storyboards).where(eq(storyboards.id, params.targetId)).limit(1)
    const sb = sbRows[0]
    if (sb?.episodeId) {
      const epRows = await db.select().from(episodes).where(eq(episodes.id, sb.episodeId)).limit(1)
      const ep = epRows[0]
      if (ep?.imageConfigId) {
        const byEp = await getConfigById(ep.imageConfigId)
        if (byEp) return byEp
      }
    }
  }
  return getActiveConfig('image')
}

async function resolveVideoConfig(params: { configId?: number; storyboardId: number }) {
  if (params.configId) {
    const byId = await getConfigById(params.configId)
    if (byId) return byId
  }
  const sbRows = await db.select().from(storyboards).where(eq(storyboards.id, params.storyboardId)).limit(1)
  const sb = sbRows[0]
  if (sb?.episodeId) {
    const epRows = await db.select().from(episodes).where(eq(episodes.id, sb.episodeId)).limit(1)
    const ep = epRows[0]
    if (ep?.videoConfigId) {
      const byEp = await getConfigById(ep.videoConfigId)
      if (byEp) return byEp
    }
  }
  return getActiveConfig('video')
}

export async function submitImageTask(params: {
  type: 'character' | 'scene' | 'prop' | 'storyboard'
  targetId: number
  prompt: string
  dramaId?: number
  configId?: number
  idempotencyKey?: string
  frameType?: 'first' | 'last'
}) {
  if (params.idempotencyKey) {
    const existing = await findActiveByIdempotency(params.idempotencyKey)
    if (existing) return existing.id
  }

  if (params.type === 'storyboard') {
    await assertStoryboardUnlocked(params.targetId)
  }

  const config = await resolveImageConfig(params)
  if (!config) throw new Error('尚未配置图片模型')
  const now = nowIso()
  const frameType = params.frameType || 'first'
  const [row] = await db.insert(sysTasks).values({
    type: 'image',
    dramaId: params.dramaId || null,
    characterId: params.type === 'character' ? params.targetId : null,
    sceneId: params.type === 'scene' ? params.targetId : null,
    propId: params.type === 'prop' ? params.targetId : null,
    storyboardId: params.type === 'storyboard' ? params.targetId : null,
    provider: config.provider,
    prompt: params.prompt,
    model: config.model,
    status: 'processing',
    progress: 0,
    idempotencyKey: params.idempotencyKey || null,
    configSnapshot: buildConfigSnapshot({ ...config, serviceType: 'image' }),
    params: JSON.stringify({ targetType: params.type, configId: config.id, frameType }),
    createdAt: now,
    updatedAt: now,
  }).returning()
  await appendTaskEvent(row.id, 'queued', '任务已入队', 0)
  return row.id
}

export async function submitVideoTask(params: {
  storyboardId: number
  prompt: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  dramaId?: number
  resolution?: string
  duration?: number
  ratio?: string
  seed?: number
  audio?: boolean
  watermark?: boolean
  promptExtend?: boolean
  referenceImages?: string[]
  configId?: number
  idempotencyKey?: string
}) {
  if (params.idempotencyKey) {
    const existing = await findActiveByIdempotency(params.idempotencyKey)
    if (existing) return existing.id
  }

  await assertStoryboardUnlocked(params.storyboardId)

  const config = await resolveVideoConfig(params)
  if (!config) throw new Error('尚未配置视频模型')

  let resolution = params.resolution
  let duration = params.duration
  let ratio = params.ratio
  let firstFrameUrl = params.firstFrameUrl
  let lastFrameUrl = params.lastFrameUrl
  let referenceImages = params.referenceImages

  const sbRows = await db.select().from(storyboards).where(eq(storyboards.id, params.storyboardId)).limit(1)
  const sb = sbRows[0]
  if (sb) {
    if (duration == null && sb.duration) duration = sb.duration
    if (!firstFrameUrl && sb.firstFrameImage) firstFrameUrl = sb.firstFrameImage
    if (!lastFrameUrl && sb.lastFrameImage) lastFrameUrl = sb.lastFrameImage
    if (!referenceImages?.length && sb.referenceImages) {
      try {
        const parsed = JSON.parse(sb.referenceImages)
        if (Array.isArray(parsed)) referenceImages = parsed.filter((x: unknown) => typeof x === 'string')
      } catch { /* ignore */ }
    }
    if (!resolution && sb.episodeId) {
      const epRows = await db.select().from(episodes).where(eq(episodes.id, sb.episodeId)).limit(1)
      const ep = epRows[0]
      if (ep?.resolution) resolution = ep.resolution
    }
  }

  const now = nowIso()
  const adapter = getVideoAdapter(config.provider || 'volcengine')
  const taskParams = {
    resolution,
    duration,
    ratio,
    seed: params.seed,
    audio: params.audio,
    watermark: params.watermark,
    promptExtend: params.promptExtend,
    firstFrameUrl,
    lastFrameUrl,
    referenceImages,
    configId: config.id,
  }
  const submit = await adapter.submit({
    prompt: params.prompt,
    config,
    firstFrameUrl,
    lastFrameUrl,
    duration,
    resolution,
    ratio,
    seed: params.seed,
    audio: params.audio,
    watermark: params.watermark,
    promptExtend: params.promptExtend,
    referenceImages,
  })
  const [row] = await db.insert(sysTasks).values({
    type: 'video',
    storyboardId: params.storyboardId,
    dramaId: params.dramaId || null,
    provider: config.provider,
    prompt: params.prompt,
    model: config.model,
    taskId: submit.taskId,
    status: 'processing',
    progress: 0,
    idempotencyKey: params.idempotencyKey || null,
    configSnapshot: buildConfigSnapshot({ ...config, serviceType: 'video' }),
    params: JSON.stringify(taskParams),
    createdAt: now,
    updatedAt: now,
  }).returning()
  await appendTaskEvent(row.id, 'queued', '任务已入队', 0)
  return row.id
}

/** TTS 旁白：同步生成并写回 storyboard.audioUrl */
export async function submitTtsTask(params: {
  storyboardId: number
  text?: string
  dramaId?: number
  voice?: string
  configId?: number
}) {
  await assertStoryboardUnlocked(params.storyboardId)

  const config = params.configId
    ? await getConfigById(params.configId)
    : await getActiveConfig('tts')
  if (!config) throw new Error('尚未配置 TTS 模型')

  const sbRows = await db.select().from(storyboards).where(eq(storyboards.id, params.storyboardId)).limit(1)
  const sb = sbRows[0]
  if (!sb) throw new Error('分镜不存在')

  const text = (params.text || sb.narrationText || sb.description || '').trim()
  if (!text) throw new Error('旁白文本为空')

  const now = nowIso()
  const [task] = await db.insert(sysTasks).values({
    type: 'tts',
    storyboardId: params.storyboardId,
    dramaId: params.dramaId || null,
    provider: config.provider,
    prompt: text,
    model: config.model,
    status: 'processing',
    progress: 0,
    configSnapshot: buildConfigSnapshot({ ...config, serviceType: 'tts' }),
    params: JSON.stringify({ configId: config.id, voice: params.voice }),
    createdAt: now,
    updatedAt: now,
  }).returning()
  await appendTaskEvent(task.id, 'queued', 'TTS 任务已入队', 0)

  try {
    const adapter = getAudioAdapter(config.provider || 'openai')
    const result = await adapter.synthesize({ text, config, voice: params.voice })
    const ext = result.mimeType.includes('wav') ? '.wav' : '.mp3'
    const saved = saveBuffer(result.buffer, 'audio', ext)

    await pushMediaVersion({
      entityType: 'storyboard',
      entityId: sb.id,
      field: 'audioUrl',
      url: sb.audioUrl,
    })

    await db.update(storyboards).set({
      audioUrl: saved.url,
      narrationText: params.text !== undefined ? params.text : sb.narrationText,
      updatedAt: nowIso(),
    }).where(eq(storyboards.id, sb.id))

    await db.update(sysTasks).set({
      status: 'completed',
      progress: 100,
      resultUrl: saved.url,
      localPath: saved.relative,
      completedAt: nowIso(),
      updatedAt: nowIso(),
    }).where(eq(sysTasks.id, task.id))
    await appendTaskEvent(task.id, 'succeeded', 'TTS 完成', 100)

    await recordUsage({
      dramaId: params.dramaId,
      episodeId: sb.episodeId,
      taskId: task.id,
      serviceType: 'tts',
      provider: config.provider,
      model: config.model,
      unitType: 'char',
      units: text.length,
      configId: config.id,
      meta: { storyboardId: sb.id },
    })

    return { taskId: task.id, audioUrl: saved.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.update(sysTasks).set({
      status: 'failed',
      errorMsg: formatTaskError(msg),
      updatedAt: nowIso(),
    }).where(eq(sysTasks.id, task.id))
    await appendTaskEvent(task.id, 'failed', formatTaskError(msg))
    throw err
  }
}

export function classifyError(msg: string): {
  code: 'CONTENT_REVIEW' | 'RATE_LIMIT' | 'AUTH' | 'UNKNOWN'
  message: string
} {
  const raw = msg || ''
  const lower = raw.toLowerCase()
  const contentKeywords = [
    '审核', '违规', '敏感', 'content policy', 'content_policy', 'moderation',
    'sensitive', 'nsfw', 'risk', 'safety', 'blocked', '违禁', '不合规',
  ]
  if (contentKeywords.some((k) => lower.includes(k.toLowerCase()) || raw.includes(k))) {
    return { code: 'CONTENT_REVIEW', message: '内容审核未通过，建议切换模型后重试' }
  }
  if (['rate limit', 'rate_limit', 'too many', '429', '限流', '配额'].some((k) => lower.includes(k) || raw.includes(k))) {
    return { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后重试' }
  }
  if (['unauthorized', '401', '403', 'invalid api', 'api key', '鉴权', '未授权'].some((k) => lower.includes(k) || raw.includes(k))) {
    return { code: 'AUTH', message: '鉴权失败，请检查 API Key 配置' }
  }
  return { code: 'UNKNOWN', message: raw || '未知错误' }
}

function formatTaskError(msg: string): string {
  const { code, message } = classifyError(msg)
  return `[${code}] ${message}`
}

const MAX_TRANSIENT_RETRIES = 3

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retry transient failures (network / 429 / 5xx). Never retry CONTENT_REVIEW or AUTH. */
export function isRetryableError(msg: string): boolean {
  const { code } = classifyError(msg)
  if (code === 'CONTENT_REVIEW' || code === 'AUTH') return false
  if (code === 'RATE_LIMIT') return true
  const lower = (msg || '').toLowerCase()
  if (/\b(429|502|503|504|500)\b/.test(lower)) return true
  if (/network|econnreset|econnrefused|etimedout|enotfound|fetch failed|socket|timed?\s*out|aborted/.test(lower)) {
    return true
  }
  return false
}

async function withTransientRetry<T>(taskId: number, label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!isRetryableError(msg) || attempt >= MAX_TRANSIENT_RETRIES) throw err
      const delay = Math.pow(2, attempt) * 1000
      logTask(taskId, `${label} 瞬态错误，${delay}ms 后重试 (${attempt + 1}/${MAX_TRANSIENT_RETRIES})`, {
        error: msg,
        code: classifyError(msg).code,
      })
      await sleep(delay)
    }
  }
  throw lastErr
}

async function loadTaskConfig(task: typeof sysTasks.$inferSelect, serviceType: 'image' | 'video' | 'tts') {
  let configId: number | undefined
  if (task.params) {
    try {
      const parsed = JSON.parse(task.params) as { configId?: number }
      if (parsed.configId) configId = parsed.configId
    } catch { /* ignore */ }
  }
  if (configId) {
    const byId = await getConfigById(configId)
    if (byId) return byId
  }
  return getActiveConfig(serviceType)
}

async function handleCancelled(taskId: number) {
  await appendTaskEvent(taskId, 'cancelled', '任务已取消')
}

async function resolveStoryboardReferenceImages(storyboardId: number): Promise<string[]> {
  const links = await db.select().from(storyboardCharacters).where(
    eq(storyboardCharacters.storyboardId, storyboardId),
  )
  if (!links.length) return []
  const charIds = links.map((l) => l.characterId)
  const chars = await db.select().from(characters).where(inArray(characters.id, charIds))
  return chars.map((c) => c.imageUrl).filter((u): u is string => !!u)
}

async function processImageTask(taskId: number) {
  const taskRows = await db.select().from(sysTasks).where(eq(sysTasks.id, taskId)).limit(1)
  const task = taskRows[0]
  if (!task || task.type !== 'image') return
  if (task.status === 'cancelled') {
    await handleCancelled(taskId)
    return
  }
  if (task.status !== 'processing') return
  if (await isTaskCancelled(taskId)) {
    await handleCancelled(taskId)
    return
  }

  const config = await loadTaskConfig(task, 'image')
  if (!config) return
  try {
    await setTaskProgress(taskId, 10, '开始生成')
    await appendTaskEvent(taskId, 'started', '开始图片生成', 10)

    if (await isTaskCancelled(taskId)) {
      await handleCancelled(taskId)
      return
    }

    const params = task.params
      ? JSON.parse(task.params) as { targetType: string; configId?: number; frameType?: 'first' | 'last' }
      : null
    const frameType = params?.frameType || 'first'

    let referenceImages: string[] | undefined
    if (params?.targetType === 'storyboard' && task.storyboardId) {
      referenceImages = await resolveStoryboardReferenceImages(task.storyboardId)
      if (!referenceImages.length) referenceImages = undefined
    }

    const saved = await withTransientRetry(taskId, '图片生成', async () => {
      const adapter = getImageAdapter(config.provider || 'openai')
      const result = await adapter.generate({
        prompt: task.prompt || '',
        config,
        referenceImages,
      })
      return saveImageWithThumb(result.buffer)
    })

    await setTaskProgress(taskId, 50, '写入结果')

    if (await isTaskCancelled(taskId)) {
      await handleCancelled(taskId)
      return
    }

    const now = nowIso()
    await db.update(sysTasks).set({
      status: 'completed',
      progress: 100,
      resultUrl: saved.url,
      localPath: saved.relative,
      completedAt: now,
      updatedAt: now,
    }).where(eq(sysTasks.id, taskId))

    if (params?.targetType === 'character' && task.characterId) {
      const prev = await db.select().from(characters).where(eq(characters.id, task.characterId)).limit(1)
      await pushMediaVersion({
        entityType: 'character',
        entityId: task.characterId,
        field: 'imageUrl',
        url: prev[0]?.imageUrl,
        localPath: prev[0]?.localPath,
      })
      await db.update(characters).set({ imageUrl: saved.url, localPath: saved.relative, updatedAt: now }).where(eq(characters.id, task.characterId))
    } else if (params?.targetType === 'scene' && task.sceneId) {
      const prev = await db.select().from(scenes).where(eq(scenes.id, task.sceneId)).limit(1)
      await pushMediaVersion({
        entityType: 'scene',
        entityId: task.sceneId,
        field: 'imageUrl',
        url: prev[0]?.imageUrl,
        localPath: prev[0]?.localPath,
      })
      await db.update(scenes).set({ imageUrl: saved.url, localPath: saved.relative, status: 'completed', updatedAt: now }).where(eq(scenes.id, task.sceneId))
    } else if (params?.targetType === 'prop' && task.propId) {
      const prev = await db.select().from(props).where(eq(props.id, task.propId)).limit(1)
      await pushMediaVersion({
        entityType: 'prop',
        entityId: task.propId,
        field: 'imageUrl',
        url: prev[0]?.imageUrl,
        localPath: prev[0]?.localPath,
      })
      await db.update(props).set({ imageUrl: saved.url, localPath: saved.relative, updatedAt: now }).where(eq(props.id, task.propId))
    } else if (params?.targetType === 'storyboard' && task.storyboardId) {
      const prev = await db.select().from(storyboards).where(eq(storyboards.id, task.storyboardId)).limit(1)
      const sb = prev[0]
      if (sb?.locked) {
        await appendTaskEvent(taskId, 'skipped', '分镜已锁定，跳过覆盖媒体')
      } else {
        const field = frameType === 'last' ? 'lastFrameImage' : 'firstFrameImage'
        await pushMediaVersion({
          entityType: 'storyboard',
          entityId: task.storyboardId,
          field,
          url: frameType === 'last' ? sb?.lastFrameImage : sb?.firstFrameImage,
        })
        const fingerprint = sb ? computeStoryboardFingerprint(sb) : null
        if (frameType === 'last') {
          await db.update(storyboards).set({
            lastFrameImage: saved.url,
            status: 'image_ready',
            inputFingerprint: fingerprint,
            updatedAt: now,
          }).where(eq(storyboards.id, task.storyboardId))
        } else {
          await db.update(storyboards).set({
            firstFrameImage: saved.url,
            status: 'image_ready',
            inputFingerprint: fingerprint,
            updatedAt: now,
          }).where(eq(storyboards.id, task.storyboardId))
        }
      }
    }

    await db.insert(assets).values({
      dramaId: task.dramaId,
      storyboardId: task.storyboardId,
      type: 'image',
      category: params?.targetType || 'generated',
      url: saved.url,
      thumbnailUrl: saved.thumbUrl,
      localPath: saved.relative,
      createdAt: now,
      updatedAt: now,
    })

    let episodeId: number | undefined
    if (task.storyboardId) {
      const sbRows = await db.select().from(storyboards).where(eq(storyboards.id, task.storyboardId)).limit(1)
      episodeId = sbRows[0]?.episodeId
    }
    await recordUsage({
      dramaId: task.dramaId,
      episodeId,
      taskId,
      serviceType: 'image',
      provider: config.provider,
      model: config.model,
      unitType: 'image',
      units: 1,
      configId: params?.configId || config.id,
    })
    await setTaskProgress(taskId, 100, '完成')
    await appendTaskEvent(taskId, 'succeeded', '图片任务完成', 100)
    logTask(taskId, '图片任务完成')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logTask(taskId, '图片任务失败', { error: msg, code: classifyError(msg).code })
    await db.update(sysTasks).set({ status: 'failed', errorMsg: formatTaskError(msg), updatedAt: nowIso() }).where(eq(sysTasks.id, taskId))
    await appendTaskEvent(taskId, 'failed', formatTaskError(msg))
  }
}

async function processVideoTask(taskId: number) {
  const taskRows = await db.select().from(sysTasks).where(eq(sysTasks.id, taskId)).limit(1)
  const task = taskRows[0]
  if (!task || task.type !== 'video' || !task.taskId) return
  if (task.status === 'cancelled') {
    await handleCancelled(taskId)
    return
  }
  if (task.status !== 'processing') return
  if (await isTaskCancelled(taskId)) {
    await handleCancelled(taskId)
    return
  }

  const config = await loadTaskConfig(task, 'video')
  if (!config) return
  try {
    await setTaskProgress(taskId, 10, '查询远程任务')

    if (await isTaskCancelled(taskId)) {
      await handleCancelled(taskId)
      return
    }

    const outcome = await withTransientRetry(taskId, '视频查询/下载', async () => {
      const adapter = getVideoAdapter(config.provider || 'volcengine')
      const result = await adapter.query(task.taskId!, config)
      if (result.status === 'processing') return { kind: 'processing' as const }
      if (result.status === 'failed') {
        const errMsg = result.error || '视频生成失败'
        if (isRetryableError(errMsg)) throw new Error(errMsg)
        return { kind: 'failed' as const, error: errMsg }
      }
      if (!result.videoUrl) throw new Error('视频 URL 为空')

      if (await isTaskCancelled(taskId)) {
        return { kind: 'cancelled' as const }
      }
      await setTaskProgress(taskId, 50, '下载视频')

      const res = await fetch(result.videoUrl)
      if (!res.ok) throw new Error(`下载视频失败: HTTP ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const saved = saveBuffer(buffer, 'videos', '.mp4')
      const posterUrl = await generateVideoPoster(saved.relative)
      return { kind: 'completed' as const, saved, posterUrl }
    })

    if (outcome.kind === 'processing') return
    if (outcome.kind === 'cancelled') {
      await handleCancelled(taskId)
      return
    }
    if (outcome.kind === 'failed') {
      logTask(taskId, '视频任务失败', { error: outcome.error, code: classifyError(outcome.error).code })
      await db.update(sysTasks).set({
        status: 'failed',
        errorMsg: formatTaskError(outcome.error),
        updatedAt: nowIso(),
      }).where(eq(sysTasks.id, taskId))
      await appendTaskEvent(taskId, 'failed', formatTaskError(outcome.error))
      return
    }

    if (await isTaskCancelled(taskId)) {
      await handleCancelled(taskId)
      return
    }

    const { saved, posterUrl } = outcome
    const now = nowIso()
    await db.update(sysTasks).set({
      status: 'completed',
      progress: 100,
      resultUrl: saved.url,
      localPath: saved.relative,
      completedAt: now,
      updatedAt: now,
    }).where(eq(sysTasks.id, taskId))

    let durationSec = 5
    let episodeId: number | undefined
    if (task.storyboardId) {
      const prev = await db.select().from(storyboards).where(eq(storyboards.id, task.storyboardId)).limit(1)
      const sb = prev[0]
      episodeId = sb?.episodeId
      if (sb?.duration) durationSec = sb.duration
      if (sb?.locked) {
        await appendTaskEvent(taskId, 'skipped', '分镜已锁定，跳过覆盖媒体')
      } else {
        await pushMediaVersion({
          entityType: 'storyboard',
          entityId: task.storyboardId,
          field: 'videoUrl',
          url: sb?.videoUrl,
        })
        const fingerprint = sb ? computeStoryboardFingerprint(sb) : null
        await db.update(storyboards).set({
          videoUrl: saved.url,
          status: 'video_ready',
          inputFingerprint: fingerprint,
          updatedAt: now,
        }).where(eq(storyboards.id, task.storyboardId))
      }
    }

    if (task.params) {
      try {
        const parsed = JSON.parse(task.params) as { duration?: number }
        if (parsed.duration) durationSec = parsed.duration
      } catch { /* ignore */ }
    }

    await db.insert(assets).values({
      dramaId: task.dramaId,
      storyboardId: task.storyboardId,
      type: 'video',
      category: 'generated',
      url: saved.url,
      thumbnailUrl: posterUrl,
      localPath: saved.relative,
      createdAt: now,
      updatedAt: now,
    })

    let configId: number | undefined
    if (task.params) {
      try {
        const parsed = JSON.parse(task.params) as { configId?: number }
        configId = parsed.configId
      } catch { /* ignore */ }
    }
    await recordUsage({
      dramaId: task.dramaId,
      episodeId,
      taskId,
      serviceType: 'video',
      provider: config.provider,
      model: config.model,
      unitType: 'second',
      units: durationSec,
      configId: configId || config.id,
    })
    await setTaskProgress(taskId, 100, '完成')
    await appendTaskEvent(taskId, 'succeeded', '视频任务完成', 100)
    logTask(taskId, '视频任务完成')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logTask(taskId, '视频任务失败', { error: msg, code: classifyError(msg).code })
    await db.update(sysTasks).set({ status: 'failed', errorMsg: formatTaskError(msg), updatedAt: nowIso() }).where(eq(sysTasks.id, taskId))
    await appendTaskEvent(taskId, 'failed', formatTaskError(msg))
  }
}

export function startTaskPoller() {
  if (pollerStarted) return
  pollerStarted = true
  setInterval(async () => {
    const tasks = await db.select().from(sysTasks).where(
      inArray(sysTasks.status, ['processing', 'pending']),
    )
    const imageTasks = tasks.filter((t) => t.type === 'image' && !t.taskId)
    const videoTasks = tasks.filter((t) => t.type === 'video' && t.taskId)

    // 图片：信号量限制并发 processImageTask
    const imageSlots = Math.max(0, IMAGE_CONCURRENCY - imageSemaphore.running)
    const imagesToStart = imageTasks.slice(0, imageSlots)
    for (const task of imagesToStart) {
      void (async () => {
        await imageSemaphore.acquire()
        try {
          await processImageTask(task.id)
        } finally {
          imageSemaphore.release()
        }
      })()
    }

    // 视频：远程任务查询，每 tick 最多 VIDEO_CONCURRENCY 个
    for (const task of videoTasks.slice(0, VIDEO_CONCURRENCY)) {
      await processVideoTask(task.id)
    }
  }, 5000)
}
