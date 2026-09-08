import type { ImageAdapter } from './types.js'

export const geminiImageAdapter: ImageAdapter = {
  async generate({ prompt, config }) {
    const model = config.model || 'imagen-3.0-generate-002'
    const url = `${config.baseUrl.replace(/\/$/, '')}/models/${model}:predict?key=${config.apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
    })
    if (!res.ok) throw new Error(`Gemini 图片生成失败: ${await res.text()}`)
    const data = await res.json() as { predictions?: Array<{ bytesBase64Encoded?: string }> }
    const b64 = data.predictions?.[0]?.bytesBase64Encoded
    if (!b64) throw new Error('Gemini 返回空图片')
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' }
  },
}
