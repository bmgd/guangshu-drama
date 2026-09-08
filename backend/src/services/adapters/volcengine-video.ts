import type { VideoAdapter, VideoSubmitInput } from './types.js'
import { fetchWithTimeout, mapProviderError } from './errors.js'
import { assertReachableMediaUrl, resolveMediaUrl } from './url.js'

async function throwIfNotOk(res: Response, provider: string) {
  if (res.ok) return
  const body = await res.text()
  throw mapProviderError(provider, res.status, body)
}

export const volcengineVideoAdapter: VideoAdapter = {
  async submit(input: VideoSubmitInput) {
    const { prompt, config, firstFrameUrl, duration = 5, resolution, ratio } = input
    const url = `${config.baseUrl.replace(/\/$/, '')}/contents/generations/tasks`
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
    const frameUrl = assertReachableMediaUrl(resolveMediaUrl(firstFrameUrl))
    if (frameUrl) {
      content.push({ type: 'image_url', image_url: { url: frameUrl } })
    }
    const body: Record<string, unknown> = {
      model: config.model || 'doubao-seedance-1-0-lite-i2v-250428',
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
    await throwIfNotOk(res, '火山引擎')
    const data = await res.json() as { id?: string; task_id?: string }
    const taskId = data.id || data.task_id
    if (!taskId) throw new Error('火山引擎未返回任务 ID')
    return { taskId }
  },

  async query(taskId, config) {
    const url = `${config.baseUrl.replace(/\/$/, '')}/contents/generations/tasks/${taskId}`
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })
    await throwIfNotOk(res, '火山引擎')
    const data = await res.json() as {
      status?: string
      output?: { video_url?: string }
      content?: { video_url?: string }
      error?: { message?: string }
    }
    const status = (data.status || '').toLowerCase()
    const errText = data.error?.message || ''
    if (status === 'succeeded' || status === 'completed') {
      const videoUrl = data.output?.video_url || data.content?.video_url
      if (!videoUrl) return { status: 'failed', error: '厂商未返回视频地址' }
      return { status: 'completed', videoUrl }
    }
    if (status === 'failed') {
      if (/审核|敏感|违规|风控|moderation|sensitive|risk|blocked/i.test(errText + JSON.stringify(data))) {
        return { status: 'failed', error: `[CONTENT_REVIEW] ${errText || '内容审核未通过'}` }
      }
      return { status: 'failed', error: errText || '视频生成失败' }
    }
    return { status: 'processing' }
  },
}
