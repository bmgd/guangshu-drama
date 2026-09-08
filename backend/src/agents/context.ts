import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getActiveConfig } from '../services/ai.js'

type TextConfigLike = {
  provider?: string | null
  apiKey: string
  baseUrl: string
  model?: string | null
}

export function createTextModelFromConfig(config: TextConfigLike) {
  if (config.provider === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: config.apiKey })
    return google(config.model || 'gemini-2.0-flash')
  }

  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl.replace(/\/$/, ''),
  })
  return openai(config.model || 'gpt-4o-mini')
}

export async function createTextModel() {
  const config = await getActiveConfig('text')
  if (!config) throw new Error('尚未配置文本模型，请前往设置页配置')
  return createTextModelFromConfig(config)
}
