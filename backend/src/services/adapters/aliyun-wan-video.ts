import type { AiConfig, VideoAdapter, VideoSubmitInput } from './types.js'
import { fetchWithTimeout, mapProviderError } from './errors.js'
import { assertReachableMediaUrl, resolveMediaUrl } from './url.js'

function resolveDashScopeBase(config: AiConfig): string {
  if (config.endpoint) {
    return config.endpoint.replace(/\/$/, '').replace(/\/services\/aigc\/video-generation\/video-synthesis$/, '')
  }
  return config.baseUrl.replace(/\/$/, '')
}

function extractTaskId(data: Record<string, unknown>): string | undefined {
  const output = data.output as Record<string, unknown> | undefined
  if (output && typeof output.task_id === 'string') return output.task_id
  if (typeof data.task_id === 'string') return data.task_id
  if (typeof data.taskId === 'string') return data.taskId
  return undefined
}

async function throwIfNotOk(res: Response, provider: string) {
  if (res.ok) return
  const body = await res.text()
  throw mapProviderError(provider, res.status, body)
}

export const aliyunWanVideoAdapter: VideoAdapter = {
  async submit(input: VideoSubmitInput) {
    const {
      prompt, config, firstFrameUrl, lastFrameUrl, referenceImages,
      duration = 5, resolution, ratio, seed, audio, watermark, promptExtend,
    } = input
    const base = resolveDashScopeBase(config)
    const url = `${base}/services/aigc/video-generation/video-synthesis`

    const media: Array<{ type: string; url: string }> = []
    const first = assertReachableMediaUrl(resolveMediaUrl(firstFrameUrl))
    if (first) media.push({ type: 'first_frame', url: first })
    const last = assertReachableMediaUrl(resolveMediaUrl(lastFrameUrl))
    if (last) media.push({ type: 'last_frame', url: last })
    for (const img of referenceImages || []) {
      const resolved = assertReachableMediaUrl(resolveMediaUrl(img))
      if (resolved) media.push({ type: 'reference_image', url: resolved })
    }

    const body: Record<string, unknown> = {
      model: config.model || 'wan2.6-t2v',
      input: {
        prompt,
        ...(media.length ? { media } : {}),
      },
      parameters: {
        ...(resolution ? { resolution } : {}),
        ...(ratio ? { ratio } : {}),
        duration,
        ...(audio !== undefined ? { audio } : {}),
        ...(seed !== undefined ? { seed } : {}),
        ...(promptExtend !== undefined ? { prompt_extend: promptExtend } : {}),
        ...(watermark !== undefined ? { watermark } : {}),
      },
    }

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    })
    await throwIfNotOk(res, '阿里云 Wan')
    const data = await res.json() as Record<string, unknown>
    const taskId = extractTaskId(data)
    if (!taskId) throw new Error('阿里云 Wan 未返回任务 ID')
    return { taskId }
  },

  async query(taskId, config) {
    const base = resolveDashScopeBase(config)
    const queryUrl = config.queryEndpoint || `${base}/tasks/${taskId}`
    const res = await fetchWithTimeout(queryUrl, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })
    await throwIfNotOk(res, '阿里云 Wan')
    const data = await res.json() as Record<string, unknown>
    const output = (data.output as Record<string, unknown> | undefined) || data
    const status = String(output.task_status || data.task_status || data.status || '').toUpperCase()
    const rawBody = JSON.stringify(data)

    if (status === 'SUCCEEDED' || status === 'SUCCESS' || status === 'COMPLETED') {
      const results = output.results as Array<{ url?: string }> | undefined
      const videoUrl = (output.video_url as string | undefined)
        || results?.[0]?.url
        || (output.url as string | undefined)
      if (!videoUrl) return { status: 'failed', error: '厂商未返回视频地址' }
      return { status: 'completed', videoUrl }
    }
    if (status === 'FAILED' || status === 'CANCELED' || status === 'CANCELLED' || status === 'UNKNOWN') {
      const errMsg = (output.message as string | undefined)
        || (output.code as string | undefined)
        || (data.message as string | undefined)
        || '视频生成失败'
      if (/审核|敏感|违规|风控|moderation|sensitive|risk|blocked/i.test(String(errMsg) + rawBody)) {
        return { status: 'failed', error: `[CONTENT_REVIEW] ${String(errMsg)}` }
      }
      return { status: 'failed', error: String(errMsg) }
    }
    return { status: 'processing' }
  },
}
