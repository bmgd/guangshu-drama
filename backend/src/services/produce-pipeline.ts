import { eq, and, isNull, inArray } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import {
  produceCheckpoints,
  episodes,
  dramas,
  characters,
  scenes,
  props,
  storyboards,
} from '../db/schema.js'
import { rewriteScript, generateScriptFromBrief, extractElements, breakStoryboard } from '../agents/index.js'
import { generatePrompts } from '../agents/index.js'
import { persistExtraction } from './extraction.js'
import { linkStoryboardCharacters } from './storyboard-links.js'
import { submitImageTask, submitVideoTask } from './generation.js'
import { mergeEpisodeVideos } from './ffmpeg-merge.js'
import { applyStoryboardPrompts, getStylePrompt } from './final-prompt.js'

export type ProduceStep =
  | 'script'
  | 'extract'
  | 'await_confirm'
  | 'confirm'
  | 'storyboard'
  | 'prompts'
  | 'sample_images'
  | 'sample_last_frames'
  | 'sample_videos'
  | 'merge'
  | 'done'

export const PRODUCE_STEPS: ProduceStep[] = [
  'script',
  'extract',
  'await_confirm',
  'confirm',
  'storyboard',
  'prompts',
  'sample_images',
  'sample_last_frames',
  'sample_videos',
  'merge',
  'done',
]

export type ProducePayload = {
  episodeId: number
  dramaId: number
  content?: string
  genre?: string
  mode?: 'rewrite' | 'generate'
  resumeFrom?: string
  sampleOnly?: boolean
  sampleCount?: number
  autoConfirmAssets?: boolean
  includeMerge?: boolean
  generateLastFrame?: boolean
}

export type ProduceEvent = {
  step: string
  message: string
  data?: unknown
}

export type ProduceSend = (event: ProduceEvent) => Promise<void>

function stepIndex(step: string | undefined | null): number {
  if (!step) return 0
  const idx = PRODUCE_STEPS.indexOf(step as ProduceStep)
  return idx >= 0 ? idx : 0
}

export async function getProduceCheckpoint(episodeId: number) {
  const rows = await db.select().from(produceCheckpoints).where(
    eq(produceCheckpoints.episodeId, episodeId),
  ).limit(1)
  return rows[0] || null
}

export async function saveProduceCheckpoint(
  episodeId: number,
  step: string,
  payload?: unknown,
) {
  const now = nowIso()
  const existing = await getProduceCheckpoint(episodeId)
  const payloadText = payload != null ? JSON.stringify(payload) : (existing?.payload || null)
  if (existing) {
    await db.update(produceCheckpoints).set({
      step,
      payload: payloadText,
      updatedAt: now,
    }).where(eq(produceCheckpoints.id, existing.id))
    return { ...existing, step, payload: payloadText, updatedAt: now }
  }
  const [row] = await db.insert(produceCheckpoints).values({
    episodeId,
    step,
    payload: payloadText,
    createdAt: now,
    updatedAt: now,
  }).returning()
  return row
}

async function loadPendingAssets(dramaId: number) {
  const [chars, scns, prps] = await Promise.all([
    db.select().from(characters).where(and(eq(characters.dramaId, dramaId), isNull(characters.deletedAt))),
    db.select().from(scenes).where(and(eq(scenes.dramaId, dramaId), isNull(scenes.deletedAt))),
    db.select().from(props).where(and(eq(props.dramaId, dramaId), isNull(props.deletedAt))),
  ])
  const pendingChars = chars.filter((c) => c.reviewStatus !== 'confirmed')
  const pendingScenes = scns.filter((s) => s.reviewStatus !== 'confirmed')
  const pendingProps = prps.filter((p) => p.reviewStatus !== 'confirmed')
  return {
    characters: pendingChars,
    scenes: pendingScenes,
    props: pendingProps,
    total: pendingChars.length + pendingScenes.length + pendingProps.length,
  }
}

async function confirmAllPending(dramaId: number) {
  const pending = await loadPendingAssets(dramaId)
  const now = nowIso()
  if (pending.characters.length) {
    await db.update(characters).set({ reviewStatus: 'confirmed', updatedAt: now }).where(
      inArray(characters.id, pending.characters.map((c) => c.id)),
    )
  }
  if (pending.scenes.length) {
    await db.update(scenes).set({ reviewStatus: 'confirmed', updatedAt: now }).where(
      inArray(scenes.id, pending.scenes.map((s) => s.id)),
    )
  }
  if (pending.props.length) {
    await db.update(props).set({ reviewStatus: 'confirmed', updatedAt: now }).where(
      inArray(props.id, pending.props.map((p) => p.id)),
    )
  }
  return {
    characterCount: pending.characters.length,
    sceneCount: pending.scenes.length,
    propCount: pending.props.length,
  }
}

function shouldRun(current: ProduceStep, resumeFrom?: string): boolean {
  if (!resumeFrom) return true
  return stepIndex(current) >= stepIndex(resumeFrom)
}

/** 可恢复样片生产流水线；在 await_confirm 暂停时返回 paused:true */
export async function runProducePipeline(
  opts: ProducePayload,
  send: ProduceSend,
): Promise<{ paused?: boolean; done?: boolean }> {
  const sampleOnly = opts.sampleOnly !== false
  const sampleCount = Math.max(1, opts.sampleCount ?? 3)
  const autoConfirmAssets = opts.autoConfirmAssets === true
  const includeMerge = opts.includeMerge === true
  const resumeFrom = opts.resumeFrom

  const epRows = await db.select().from(episodes).where(eq(episodes.id, opts.episodeId)).limit(1)
  const episode = epRows[0]
  if (!episode) throw new Error('剧集不存在')

  const dramaRows = await db.select().from(dramas).where(eq(dramas.id, opts.dramaId)).limit(1)
  const drama = dramaRows[0]
  if (!drama) throw new Error('项目不存在')

  const wantLastFrame = opts.generateLastFrame === true || drama.generationMode === 'first_last_frame'

  // —— script ——
  if (shouldRun('script', resumeFrom)) {
    await send({ step: 'script', message: '正在处理剧本...' })
    const content = (opts.content || episode.content || '').trim()
    let scriptText = episode.scriptContent || ''
    let scriptMeta: unknown = null
    if (opts.mode === 'generate') {
      if (!content) throw new Error('从大纲生成需要 content/brief')
      const result = await generateScriptFromBrief({ brief: content, genre: opts.genre })
      scriptText = result.script
      scriptMeta = result
      await db.update(episodes).set({
        scriptContent: result.script,
        title: result.title || episode.title,
        content,
        updatedAt: nowIso(),
      }).where(eq(episodes.id, opts.episodeId))
    } else if (content) {
      const result = await rewriteScript({ content, genre: opts.genre })
      scriptText = result.script
      scriptMeta = result
      await db.update(episodes).set({
        scriptContent: result.script,
        title: result.title || episode.title,
        updatedAt: nowIso(),
      }).where(eq(episodes.id, opts.episodeId))
    } else if (!scriptText) {
      throw new Error('缺少原文内容或已有剧本')
    }
    await saveProduceCheckpoint(opts.episodeId, 'script', { scriptLength: scriptText.length })
    await send({ step: 'script', message: '剧本处理完成', data: scriptMeta })
  }

  // —— extract ——
  if (shouldRun('extract', resumeFrom)) {
    await send({ step: 'extract', message: '正在提取角色/场景/道具...' })
    const ep2 = (await db.select().from(episodes).where(eq(episodes.id, opts.episodeId)).limit(1))[0]
    const script = ep2?.scriptContent
    if (!script) throw new Error('请先完成剧本')
    const extracted = await extractElements(script)
    const stats = await persistExtraction(opts.dramaId, opts.episodeId, extracted)
    await saveProduceCheckpoint(opts.episodeId, 'extract', { stats })
    await send({ step: 'extract', message: '元素提取完成', data: { stats, extracted } })
  }

  // —— await_confirm ——
  if (shouldRun('await_confirm', resumeFrom)) {
    const pending = await loadPendingAssets(opts.dramaId)
    if (!autoConfirmAssets && pending.total > 0) {
      await saveProduceCheckpoint(opts.episodeId, 'await_confirm', {
        pending: {
          characters: pending.characters.map((c) => ({ id: c.id, name: c.name })),
          scenes: pending.scenes.map((s) => ({ id: s.id, location: s.location })),
          props: pending.props.map((p) => ({ id: p.id, name: p.name })),
        },
      })
      await send({
        step: 'await_confirm',
        message: '请先确认角色/场景/道具',
        data: {
          characterCount: pending.characters.length,
          sceneCount: pending.scenes.length,
          propCount: pending.props.length,
        },
      })
      return { paused: true }
    }
    await saveProduceCheckpoint(opts.episodeId, 'await_confirm', { skipped: true, total: pending.total })
    await send({ step: 'await_confirm', message: pending.total ? '将自动确认资产' : '无需确认资产' })
  }

  // —— confirm ——
  if (shouldRun('confirm', resumeFrom)) {
    await send({ step: 'confirm', message: '正在确认资产...' })
    const confirmed = await confirmAllPending(opts.dramaId)
    await saveProduceCheckpoint(opts.episodeId, 'confirm', confirmed)
    await send({ step: 'confirm', message: '资产确认完成', data: confirmed })
  }

  // —— storyboard ——
  if (shouldRun('storyboard', resumeFrom)) {
    await send({ step: 'storyboard', message: '正在拆解分镜...' })
    const ep3 = (await db.select().from(episodes).where(eq(episodes.id, opts.episodeId)).limit(1))[0]
    const script = ep3?.scriptContent
    if (!script) throw new Error('请先完成剧本')
    const boards = await breakStoryboard(script)
    const existing = await db.select().from(storyboards).where(eq(storyboards.episodeId, opts.episodeId))
    for (const sb of existing) {
      if (sb.locked || sb.deletedAt) continue
      await db.update(storyboards).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(storyboards.id, sb.id))
    }
    const now = nowIso()
    const createdIds: number[] = []
    for (const item of boards.storyboards) {
      const [row] = await db.insert(storyboards).values({
        episodeId: opts.episodeId,
        storyboardNumber: item.storyboardNumber,
        title: item.title || null,
        location: item.location || null,
        time: item.time || null,
        shotType: item.shotType || null,
        angle: item.angle || null,
        movement: item.movement || null,
        result: item.result || null,
        atmosphere: item.atmosphere || null,
        description: item.description || null,
        duration: item.duration || 0,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }).returning()
      createdIds.push(row.id)
      if (item.characterNames?.length) {
        await linkStoryboardCharacters(row.id, item.characterNames, opts.dramaId)
      }
    }
    await saveProduceCheckpoint(opts.episodeId, 'storyboard', { count: createdIds.length, ids: createdIds })
    await send({ step: 'storyboard', message: '分镜拆解完成', data: { count: createdIds.length } })
  }

  // —— prompts ——
  if (shouldRun('prompts', resumeFrom)) {
    await send({ step: 'prompts', message: '正在生成提示词...' })
    const boards = await db.select().from(storyboards).where(
      and(eq(storyboards.episodeId, opts.episodeId), isNull(storyboards.deletedAt)),
    )
    const unlocked = boards.filter((b) => !b.locked)
    if (unlocked.length) {
      const stylePrompt = await getStylePrompt(opts.dramaId)
      const items = unlocked.map((b) => ({
        id: b.id,
        description: b.description,
        shotType: b.shotType,
        movement: b.movement,
        atmosphere: b.atmosphere,
        location: b.location,
        time: b.time,
      }))
      const result = await generatePrompts({ type: 'storyboard', items, stylePrompt })
      for (const item of result.items) {
        const id = Number(item.id)
        if (!Number.isFinite(id)) continue
        if (item.type === 'storyboard_image') await applyStoryboardPrompts(id, item.prompt)
        else if (item.type === 'storyboard_video') await applyStoryboardPrompts(id, undefined, item.prompt)
      }
    }
    await saveProduceCheckpoint(opts.episodeId, 'prompts', { boardCount: unlocked.length })
    await send({ step: 'prompts', message: '提示词生成完成' })
  }

  // —— sample_images ——
  let sampleBoardIds: number[] = []
  const prevCp = await getProduceCheckpoint(opts.episodeId)
  if (prevCp?.payload) {
    try {
      const parsed = JSON.parse(prevCp.payload) as { sampleBoardIds?: number[] }
      if (Array.isArray(parsed.sampleBoardIds)) sampleBoardIds = parsed.sampleBoardIds
    } catch { /* ignore */ }
  }
  if (shouldRun('sample_images', resumeFrom)) {
    await send({ step: 'sample_images', message: '正在提交样片首帧...' })
    sampleBoardIds = []
    const boards = await db.select().from(storyboards).where(
      and(eq(storyboards.episodeId, opts.episodeId), isNull(storyboards.deletedAt)),
    )
    const unlocked = boards
      .filter((b) => !b.locked)
      .sort((a, b) => a.storyboardNumber - b.storyboardNumber)
    const targets = (sampleOnly ? unlocked.slice(0, sampleCount) : unlocked)
    const taskIds: number[] = []
    for (const sb of targets) {
      const prompt = sb.imagePrompt || sb.description || ''
      if (!prompt) continue
      const taskId = await submitImageTask({
        type: 'storyboard',
        targetId: sb.id,
        prompt,
        dramaId: opts.dramaId,
        frameType: 'first',
        idempotencyKey: `produce-img-first-${opts.episodeId}-${sb.id}`,
      })
      taskIds.push(taskId)
      sampleBoardIds.push(sb.id)
    }
    await saveProduceCheckpoint(opts.episodeId, 'sample_images', { taskIds, sampleBoardIds })
    await send({ step: 'sample_images', message: `已提交 ${taskIds.length} 个首帧任务`, data: { taskIds } })
  }

  // —— sample_last_frames ——
  if (shouldRun('sample_last_frames', resumeFrom)) {
    if (wantLastFrame) {
      await send({ step: 'sample_last_frames', message: '正在提交样片尾帧...' })
      const boards = await db.select().from(storyboards).where(
        and(eq(storyboards.episodeId, opts.episodeId), isNull(storyboards.deletedAt)),
      )
      const unlocked = boards
        .filter((b) => !b.locked)
        .sort((a, b) => a.storyboardNumber - b.storyboardNumber)
      let targets = sampleOnly ? unlocked.slice(0, sampleCount) : unlocked
      if (sampleBoardIds.length) {
        const set = new Set(sampleBoardIds)
        targets = unlocked.filter((b) => set.has(b.id))
      }
      const taskIds: number[] = []
      for (const sb of targets) {
        const prompt = sb.imagePrompt || sb.description || ''
        if (!prompt) continue
        const taskId = await submitImageTask({
          type: 'storyboard',
          targetId: sb.id,
          prompt: `${prompt}（镜头尾帧 / last frame）`,
          dramaId: opts.dramaId,
          frameType: 'last',
          idempotencyKey: `produce-img-last-${opts.episodeId}-${sb.id}`,
        })
        taskIds.push(taskId)
      }
      await saveProduceCheckpoint(opts.episodeId, 'sample_last_frames', { taskIds })
      await send({ step: 'sample_last_frames', message: `已提交 ${taskIds.length} 个尾帧任务`, data: { taskIds } })
    } else {
      await saveProduceCheckpoint(opts.episodeId, 'sample_last_frames', { skipped: true })
      await send({ step: 'sample_last_frames', message: '跳过尾帧（未启用首尾帧模式）' })
    }
  }

  // —— sample_videos ——
  if (shouldRun('sample_videos', resumeFrom)) {
    await send({ step: 'sample_videos', message: '正在提交样片视频...' })
    const boards = await db.select().from(storyboards).where(
      and(eq(storyboards.episodeId, opts.episodeId), isNull(storyboards.deletedAt)),
    )
    const unlocked = boards
      .filter((b) => !b.locked)
      .sort((a, b) => a.storyboardNumber - b.storyboardNumber)
    let targets = sampleOnly ? unlocked.slice(0, sampleCount) : unlocked
    if (sampleBoardIds.length) {
      const set = new Set(sampleBoardIds)
      targets = unlocked.filter((b) => set.has(b.id))
    }
    const withFrame = targets.filter((b) => b.firstFrameImage)
    const taskIds: number[] = []
    for (const sb of withFrame) {
      const prompt = sb.videoPrompt || sb.imagePrompt || sb.description || ''
      if (!prompt) continue
      const taskId = await submitVideoTask({
        storyboardId: sb.id,
        prompt,
        firstFrameUrl: sb.firstFrameImage || undefined,
        lastFrameUrl: sb.lastFrameImage || undefined,
        dramaId: opts.dramaId,
        duration: sb.duration || 5,
        idempotencyKey: `produce-vid-${opts.episodeId}-${sb.id}`,
      })
      taskIds.push(taskId)
    }
    await saveProduceCheckpoint(opts.episodeId, 'sample_videos', { taskIds, skippedNoFrame: targets.length - withFrame.length })
    await send({
      step: 'sample_videos',
      message: withFrame.length
        ? `已提交 ${taskIds.length} 个视频任务`
        : '暂无首帧可用，视频任务跳过（可待首帧完成后从检查点继续）',
      data: { taskIds },
    })
  }

  // —— merge ——
  if (shouldRun('merge', resumeFrom)) {
    if (includeMerge) {
      await send({ step: 'merge', message: '正在合并成片...' })
      try {
        const result = await mergeEpisodeVideos(opts.episodeId)
        await saveProduceCheckpoint(opts.episodeId, 'merge', result)
        await send({ step: 'merge', message: '成片合并完成', data: result })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await saveProduceCheckpoint(opts.episodeId, 'merge', { error: msg })
        await send({ step: 'merge', message: `合并跳过或失败: ${msg}` })
      }
    } else {
      await saveProduceCheckpoint(opts.episodeId, 'merge', { skipped: true })
      await send({ step: 'merge', message: '跳过合并' })
    }
  }

  // —— done ——
  await saveProduceCheckpoint(opts.episodeId, 'done', { finishedAt: nowIso() })
  await send({ step: 'done', message: '一键生产完成' })
  return { done: true }
}
