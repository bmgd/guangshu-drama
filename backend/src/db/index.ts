import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.js'
import { stylePresets, aiServiceProviders } from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const databaseUrl = process.env.DATABASE_URL
  || 'postgres://guangshu:guangshu@127.0.0.1:5432/guangshu_drama'

const client = postgres(databaseUrl, { max: 10 })
export const db = drizzle(client, { schema })

const stylePresetSeeds = [
  { name: '3D 漫剧', value: '3d', sortOrder: 1, prompt: '3D CG animation style, game-engine quality render, semi-realistic stylized characters, refined facial features, detailed materials and textures, cinematic lighting, high detail', description: '游戏引擎级 3D 渲染，半写实角色，当前短剧主流的 3D 漫剧质感' },
  { name: '日漫赛璐璐', value: 'anime', sortOrder: 2, prompt: 'Japanese anime style, cel shading, clean crisp line art, vivid saturated colors, expressive character designs, detailed painted backgrounds', description: '日式赛璐璐动画风格' },
  { name: '吉卜力手绘', value: 'ghibli', sortOrder: 3, prompt: 'Studio Ghibli style, hand-drawn animation, soft watercolor painted backgrounds, warm nostalgic lighting, gentle natural palette, whimsical cozy atmosphere', description: '吉卜力手绘治愈风' },
  { name: '水彩绘本', value: 'watercolor', sortOrder: 4, prompt: 'watercolor illustration style, soft translucent washes, visible paper texture, delicate fluid brushwork, light airy atmosphere, hand-painted storybook feel', description: '水彩插画质感' },
  { name: '美式漫画', value: 'comic', sortOrder: 5, prompt: 'Western comic book style, bold black ink outlines, halftone dot shading, dynamic saturated colors, dramatic contrast lighting, flat graphic novel look', description: '美式漫画粗线条风格' },
]

const providerSeeds = [
  { name: 'openai-text', displayName: 'OpenAI 文本', serviceType: 'text', provider: 'openai', defaultUrl: 'https://api.openai.com/v1', presetModels: JSON.stringify(['gpt-4o', 'gpt-4o-mini']), description: 'OpenAI 兼容文本接口' },
  { name: 'gemini-text', displayName: 'Gemini 文本', serviceType: 'text', provider: 'gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta', presetModels: JSON.stringify(['gemini-2.0-flash', 'gemini-2.5-pro']), description: 'Google Gemini 文本接口' },
  { name: 'openai-image', displayName: 'OpenAI 图片', serviceType: 'image', provider: 'openai', defaultUrl: 'https://api.openai.com/v1', presetModels: JSON.stringify(['gpt-image-1', 'dall-e-3']), description: 'OpenAI 图片生成' },
  { name: 'gemini-image', displayName: 'Gemini 图片', serviceType: 'image', provider: 'gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta', presetModels: JSON.stringify(['imagen-3.0-generate-002']), description: 'Gemini Imagen 图片生成' },
  { name: 'volcengine-image', displayName: '火山引擎图片', serviceType: 'image', provider: 'volcengine', defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3', presetModels: JSON.stringify(['doubao-seedream-3-0-t2i-250415']), description: '火山引擎 Seedream 图片生成' },
  { name: 'volcengine-video', displayName: '火山引擎视频', serviceType: 'video', provider: 'volcengine', defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3', presetModels: JSON.stringify(['doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-lite-i2v-250428']), description: '火山引擎 Seedance 视频生成' },
  { name: 'minimax-video', displayName: 'MiniMax 视频', serviceType: 'video', provider: 'minimax', defaultUrl: 'https://api.minimaxi.com/v1', presetModels: JSON.stringify(['MiniMax-Hailuo-02', 'T2V-01', 'I2V-01']), description: 'MiniMax Hailuo 视频生成' },
  { name: 'aliyun-wan-video', displayName: '阿里云百炼 Wan 3.0', serviceType: 'video', provider: 'aliyun', defaultUrl: 'https://dashscope.aliyuncs.com/api/v1', presetModels: JSON.stringify(['wan2.6-t2v', 'wan2.6-i2v', 'wan2.5-t2v-preview']), description: '阿里云百炼 Wan 视频生成' },
  { name: 'openai-tts', displayName: 'OpenAI TTS', serviceType: 'tts', provider: 'openai', defaultUrl: 'https://api.openai.com/v1', presetModels: JSON.stringify(['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts']), description: 'OpenAI 兼容 TTS 语音合成' },
]

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForDatabase(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      await client`SELECT 1`
      return
    } catch (err) {
      const delay = Math.min(1000 * 2 ** i, 8000)
      console.warn(`数据库连接失败 (${i + 1}/${retries})，${delay}ms 后重试...`, err instanceof Error ? err.message : err)
      await sleep(delay)
    }
  }
  throw new Error('无法连接 PostgreSQL，请检查 DATABASE_URL')
}

export async function initDatabase() {
  await waitForDatabase()
  const migrationsFolder = join(__dirname, '../../drizzle')
  try {
    await migrate(db, { migrationsFolder })
  } catch (err) {
    // 首次无 migration 目录时用 drizzle-kit push 等价：创建核心表
    console.warn('migrate 跳过或失败，尝试确保 schema 可用:', err instanceof Error ? err.message : err)
  }

  const now = nowIso()
  for (const seed of stylePresetSeeds) {
    const existing = await db.select().from(stylePresets).where(eq(stylePresets.value, seed.value)).limit(1)
    if (!existing[0]) {
      await db.insert(stylePresets).values({
        name: seed.name,
        value: seed.value,
        prompt: seed.prompt,
        description: seed.description,
        sortOrder: seed.sortOrder,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  for (const seed of providerSeeds) {
    const existing = await db.select().from(aiServiceProviders).where(eq(aiServiceProviders.name, seed.name)).limit(1)
    if (!existing[0]) {
      await db.insert(aiServiceProviders).values({
        name: seed.name,
        displayName: seed.displayName,
        serviceType: seed.serviceType,
        provider: seed.provider,
        defaultUrl: seed.defaultUrl,
        presetModels: seed.presetModels,
        description: seed.description,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    }
  }
}

export function nowIso() {
  return new Date().toISOString()
}

export { client }
