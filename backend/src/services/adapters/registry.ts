import type { ImageAdapter, VideoAdapter, AudioAdapter } from './types.js'
import { openaiImageAdapter } from './openai-image.js'
import { geminiImageAdapter } from './gemini-image.js'
import { volcengineImageAdapter } from './volcengine-image.js'
import { volcengineVideoAdapter } from './volcengine-video.js'
import { minimaxVideoAdapter } from './minimax-video.js'
import { aliyunWanVideoAdapter } from './aliyun-wan-video.js'
import { openaiTtsAdapter } from './openai-tts.js'

const imageAdapters: Record<string, ImageAdapter> = {
  openai: openaiImageAdapter,
  gemini: geminiImageAdapter,
  volcengine: volcengineImageAdapter,
}

const videoAdapters: Record<string, VideoAdapter> = {
  volcengine: volcengineVideoAdapter,
  minimax: minimaxVideoAdapter,
  aliyun: aliyunWanVideoAdapter,
}

const audioAdapters: Record<string, AudioAdapter> = {
  openai: openaiTtsAdapter,
}

export function getImageAdapter(provider: string) {
  const adapter = imageAdapters[provider]
  if (!adapter) throw new Error(`不支持的图片厂商: ${provider}`)
  return adapter
}

export function getVideoAdapter(provider: string) {
  const adapter = videoAdapters[provider]
  if (!adapter) throw new Error(`不支持的视频厂商: ${provider}`)
  return adapter
}

export function getAudioAdapter(provider: string) {
  const adapter = audioAdapters[provider]
  if (!adapter) throw new Error(`不支持的 TTS 厂商: ${provider}`)
  return adapter
}
