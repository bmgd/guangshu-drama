import type { AiConfig, VideoAdapter, VideoSubmitInput } from './types.js'
import { fetchWithTimeout, mapProviderError } from './errors.js'
import { assertReachableMediaUrl, resolveMediaUrl } from './url.js'

function resolveMinimaxRoot(config: AiConfig): string {
  if (config.endpoint) {
    return config.endpoint.replace(/\/$/, '').replace(/\/v2\/video_generation$/, '').replace(/\/video_generation$/, '')
  }
  return config.baseUrl.replace(/\/$/, '').replace(/\/v1$/, '')
}

function isLegacyHailuoModel(model?: string | null): boolean {
  if (!model) return false
  return /Hailuo|T2V|I2V/i.test(model)
}

function extractTaskId(data: Record<string, unknown>): string | undefined {
  if (typeof data.task_id === 'string') return data.task_id
  if (typeof data.taskId === 'string') return data.taskId
  const nested = data.data as Record<string, unknown> | undefined
  if (nested && typeof nested.task_id === 'string') return nested.task_id
  if (typeof data.id === 'string') return data.id
  return undefined
}

async function throwIfNotOk(res: Response, provider: string) {
  if (res.ok) return
  const body = await res.text()
  throw mapProviderError(provider, res.status, body)
}

export const minimaxVideoAdapter: VideoAdapter = {
  async submit(input: VideoSubmitInput) {
    const { prompt, config, firstFrameUrl, duration = 5, resolution, ratio } = input
    const model = config.model || 'MiniMax-Hailuo-02'
    const root = resolveMinimaxRoot(config)
    const frameUrl = assertReachableMediaUrl(resolveMediaUrl(firstFrameUrl))

    // 旧版 Hailuo / T2V / I2V 路径（H3 模型走下方 v2）
    if (isLegacyHailuoModel(model) && !/H3/i.test(model)) {
      const url = `${root}/video_generation`
      const body: Record<string, unknown> = {
        model,
        prompt,
        duration,
      }
      if (frameUrl) body.first_frame_image = frameUrl
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      await throwIfNotOk(res, 'MiniMax')
      const data = await res.json() as Record<string, unknown>
      const taskId = extractTaskId(data)
      if (!taskId) throw new Error('MiniMax 未返回任务 ID')
      return { taskId }
    }

    // MiniMax H3 / v2 主路径
    const url = `${root}/v2/video_generation`
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
    if (frameUrl) {
      content.push({ type: 'image_url', image_url: { url: frameUrl } })
    }
    const body: Record<string, unknown> = {
      model,
      content,
      duration,
    }
    if (resolution) body.resolution = resolution
    if (ratio) body.ratio = ratio

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    await throwIfNotOk(res, 'MiniMax')
    const data = await res.json() as Record<string, unknown>
    const taskId = extractTaskId(data)
    if (!taskId) throw new Error('MiniMax 未返回任务 ID')
    return { taskId }
  },

  async query(taskId, config) {
    const root = resolveMinimaxRoot(config)
    const queryUrl = config.queryEndpoint
      || `${root}/v2/query/video_generation/${taskId}`
    const res = await fetchWithTimeout(queryUrl, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })
    await throwIfNotOk(res, 'MiniMax')
    const data = await res.json() as Record<string, unknown>
    const task = (data.task as Record<string, unknown> | undefined)
      || (data.data as Record<string, unknown> | undefined)
      || data
    const status = String(task.status || data.status || '').toLowerCase()
    const rawBody = JSON.stringify(data)

    if (status === 'succeeded' || status === 'success' || status === 'completed') {
      const content = task.content as Record<string, unknown> | undefined
      const videoUrl = (content?.url as string | undefined)
        || (task.video_url as string | undefined)
        || (task.file_url as string | undefined)
        || (data.video_url as string | undefined)
      if (!videoUrl) return { status: 'failed', error: '厂商未返回视频地址' }
      return { status: 'completed', videoUrl }
    }
    if (['failed', 'cancelled', 'canceled', 'expired', 'error'].includes(status)) {
      const errMsg = (task.error as string | undefined)
        || ((task.base_resp as Record<string, unknown> | undefined)?.status_msg as string | undefined)
        || (data.error as string | undefined)
        || '视频生成失败'
      if (/审核|敏感|违规|风控|moderation|sensitive|risk|blocked/i.test(String(errMsg) + rawBody)) {
        return { status: 'failed', error: `[CONTENT_REVIEW] ${String(errMsg)}` }
      }
      return { status: 'failed', error: String(errMsg) }
    }
    return { status: 'processing' }
  },
}
