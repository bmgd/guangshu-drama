import type { AudioAdapter } from './types.js'

/**
 * OpenAI-compatible TTS：POST `{base}/audio/speech`
 * Body 对齐官方 OpenAI TTS API：`{ model, input, voice }`
 */
export const openaiTtsAdapter: AudioAdapter = {
  async synthesize({ text, config, voice }) {
    const base = config.baseUrl.replace(/\/$/, '')
    const url = `${base}/audio/speech`
    let settingsVoice = voice
    if (!settingsVoice && config.settings) {
      try {
        const s = JSON.parse(config.settings) as { voice?: string }
        if (s.voice) settingsVoice = s.voice
      } catch { /* ignore */ }
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'tts-1',
        input: text,
        voice: settingsVoice || 'alloy',
      }),
    })
    if (!res.ok) throw new Error(`OpenAI TTS 失败: ${await res.text()}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type') || 'audio/mpeg'
    return { buffer, mimeType }
  },
}
