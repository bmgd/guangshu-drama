import type { ImageAdapter } from './types.js'
import { readLocalFile } from '../../utils/storage.js'

async function resolveImageToDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url
    const local = readLocalFile(url)
    if (local) {
      const b64 = local.toString('base64')
      const mime = url.endsWith('.jpg') || url.endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
      return `data:${mime};base64,${b64}`
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      const mime = res.headers.get('content-type') || 'image/png'
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  } catch {
    return null
  }
  return null
}

export const volcengineImageAdapter: ImageAdapter = {
  async generate({ prompt, config, size = '1024x1024', referenceImages }) {
    const url = `${config.baseUrl.replace(/\/$/, '')}/images/generations`
    let finalPrompt = prompt
    const body: Record<string, unknown> = {
      model: config.model || 'doubao-seedream-3-0-t2i-250415',
      prompt: finalPrompt,
      size,
      response_format: 'b64_json',
    }

    if (referenceImages?.length) {
      const resolved: string[] = []
      for (const ref of referenceImages.slice(0, 4)) {
        const dataUrl = await resolveImageToDataUrl(ref)
        if (dataUrl) resolved.push(dataUrl)
        else if (ref.startsWith('http')) resolved.push(ref)
      }
      if (resolved.length === 1) {
        body.image = resolved[0]
      } else if (resolved.length > 1) {
        body.image = resolved
      }
      // 补充提示，帮助模型保持角色一致
      finalPrompt = `${prompt}\n\n[Character reference images provided for identity consistency]`
      body.prompt = finalPrompt
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`火山引擎图片生成失败: ${await res.text()}`)
    const data = await res.json() as { data?: Array<{ b64_json?: string; url?: string }> }
    const item = data.data?.[0]
    if (item?.b64_json) {
      return { buffer: Buffer.from(item.b64_json, 'base64'), mimeType: 'image/png' }
    }
    if (item?.url) {
      const imgRes = await fetch(item.url)
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      return { buffer, mimeType: imgRes.headers.get('content-type') || 'image/png' }
    }
    throw new Error('火山引擎返回空图片')
  },
}
