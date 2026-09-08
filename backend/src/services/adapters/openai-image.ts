import type { ImageAdapter } from './types.js'

export const openaiImageAdapter: ImageAdapter = {
  async generate({ prompt, config, size = '1024x1024', referenceImages }) {
    let finalPrompt = prompt
    if (referenceImages?.length) {
      finalPrompt = `${prompt}\n\nReference character images (keep identity consistent):\n${referenceImages.slice(0, 4).join('\n')}`
    }
    const url = `${config.baseUrl.replace(/\/$/, '')}/images/generations`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'gpt-image-1',
        prompt: finalPrompt,
        size,
        response_format: 'b64_json',
      }),
    })
    if (!res.ok) throw new Error(`OpenAI 图片生成失败: ${await res.text()}`)
    const data = await res.json() as { data: Array<{ b64_json: string }> }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI 返回空图片')
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' }
  },
}
