import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { aiServiceConfigs, aiServiceProviders } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'
import { getActiveConfig, maskApiKey } from '../services/ai.js'
import { generateText } from 'ai'
import { createTextModel, createTextModelFromConfig } from '../agents/context.js'
import { mapProviderError, fetchWithTimeout } from '../services/adapters/errors.js'
import { getImageAdapter } from '../services/adapters/registry.js'

export const aiConfigsRouter = new Hono()

aiConfigsRouter.get('/providers', async (c) => {
  const rows = await db.select().from(aiServiceProviders).where(eq(aiServiceProviders.isActive, true))
  return jsonOk(c, rows)
})

aiConfigsRouter.get('/', async (c) => {
  const serviceType = c.req.query('serviceType')
  let rows = await db.select().from(aiServiceConfigs)
  if (serviceType) rows = rows.filter((r) => r.serviceType === serviceType)
  return jsonOk(c, rows.map((r) => ({ ...r, apiKey: maskApiKey(r.apiKey) })))
})

aiConfigsRouter.get('/status', async (c) => {
  const types = ['text', 'image', 'video'] as const
  const status = Object.fromEntries(await Promise.all(types.map(async (t) => {
    const rows = await db.select().from(aiServiceConfigs)
      .where(and(eq(aiServiceConfigs.serviceType, t), eq(aiServiceConfigs.isActive, true)))
    return [t, rows.some((r) => r.isDefault) || rows.length > 0] as const
  })))
  return jsonOk(c, { configured: Object.values(status).every(Boolean), ...status })
})

aiConfigsRouter.post('/', async (c) => {
  const body = await c.req.json<typeof aiServiceConfigs.$inferInsert>()
  if (!body.serviceType || !body.name || !body.baseUrl || !body.apiKey) return jsonFail(c, '参数不完整')
  const now = nowIso()
  if (body.isDefault) {
    await db.update(aiServiceConfigs)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(aiServiceConfigs.serviceType, body.serviceType))
  }
  const [row] = await db.insert(aiServiceConfigs).values({
    serviceType: body.serviceType,
    provider: body.provider || 'openai',
    name: body.name,
    baseUrl: body.baseUrl,
    apiKey: body.apiKey,
    model: body.model || null,
    endpoint: body.endpoint || null,
    queryEndpoint: body.queryEndpoint || null,
    priority: body.priority || 0,
    isDefault: body.isDefault ?? false,
    isActive: body.isActive ?? true,
    settings: body.settings || null,
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, { ...row, apiKey: maskApiKey(row!.apiKey) }, 201)
})

aiConfigsRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof aiServiceConfigs.$inferInsert>>()
  const existingRows = await db.select().from(aiServiceConfigs).where(eq(aiServiceConfigs.id, id)).limit(1)
  const existing = existingRows[0]
  if (!existing) return jsonFail(c, '配置不存在', 404)
  const now = nowIso()
  if (body.isDefault) {
    await db.update(aiServiceConfigs)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(aiServiceConfigs.serviceType, existing.serviceType))
  }
  await db.update(aiServiceConfigs).set({
    ...body,
    apiKey: body.apiKey && !body.apiKey.includes('****') ? body.apiKey : existing.apiKey,
    updatedAt: now,
  }).where(eq(aiServiceConfigs.id, id))
  const rows = await db.select().from(aiServiceConfigs).where(eq(aiServiceConfigs.id, id)).limit(1)
  const row = rows[0]
  return jsonOk(c, { ...row, apiKey: maskApiKey(row!.apiKey) })
})

aiConfigsRouter.delete('/:id', async (c) => {
  await db.delete(aiServiceConfigs).where(eq(aiServiceConfigs.id, Number(c.req.param('id'))))
  return jsonOk(c, { deleted: true })
})

const videoTemplates = {
  volcengine: {
    provider: 'volcengine',
    name: '默认视频·火山',
    model: 'doubao-seedance-1-0-lite-i2v-250428',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  minimax: {
    provider: 'minimax',
    name: '默认视频·MiniMax',
    model: 'MiniMax-Hailuo-02',
    baseUrl: 'https://api.minimaxi.com/v1',
  },
  aliyun: {
    provider: 'aliyun',
    name: '默认视频·Wan',
    model: 'wan2.6-t2v',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
  },
} as const

aiConfigsRouter.post('/quick-setup', async (c) => {
  const body = await c.req.json<{
    apiKey: string
    baseUrl?: string
    videoProvider?: 'volcengine' | 'minimax' | 'aliyun'
  }>()
  if (!body.apiKey) return jsonFail(c, 'API Key 不能为空')
  const baseUrl = body.baseUrl || 'https://api.openai.com/v1'
  const videoTpl = videoTemplates[body.videoProvider || 'volcengine']
  const now = nowIso()
  const templates = [
    { serviceType: 'text' as const, provider: 'openai', name: '默认文本', model: 'gpt-4o-mini', baseUrl },
    { serviceType: 'image' as const, provider: 'openai', name: '默认图片', model: 'gpt-image-1', baseUrl },
    {
      serviceType: 'video' as const,
      provider: videoTpl.provider,
      name: videoTpl.name,
      model: videoTpl.model,
      baseUrl: videoTpl.baseUrl,
    },
  ]
  for (const t of templates) {
    await db.update(aiServiceConfigs).set({ isDefault: false, updatedAt: now }).where(eq(aiServiceConfigs.serviceType, t.serviceType))
    await db.insert(aiServiceConfigs).values({
      serviceType: t.serviceType,
      provider: t.provider,
      name: t.name,
      baseUrl: t.baseUrl,
      apiKey: body.apiKey,
      model: t.model,
      isDefault: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }
  return jsonOk(c, { message: '快捷配置完成' })
})

function classifyTestError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/\[AUTH\]|401|403|unauthorized|invalid.?api.?key|鉴权|密钥/i.test(raw)) {
    return mapProviderError('AI', 401, raw).message
  }
  if (/\[RATE_LIMIT\]|429|rate.?limit|限流/i.test(raw)) {
    return mapProviderError('AI', 429, raw).message
  }
  if (/\[TIMEOUT\]|timeout|超时/i.test(raw)) {
    return mapProviderError('AI', 408, raw).message
  }
  if (/\[CONTENT_REVIEW\]|审核|敏感|moderation/i.test(raw)) {
    return mapProviderError('AI', 400, raw).message
  }
  return raw.includes('[') ? raw : `连通性测试失败: ${raw}`
}

aiConfigsRouter.post('/test', async (c) => {
  const body = await c.req.json<{ serviceType: 'text' | 'image' | 'video' | 'tts'; configId?: number }>()
  if (!body.serviceType) return jsonFail(c, '请指定 serviceType')

  try {
    let config = body.configId
      ? (await db.select().from(aiServiceConfigs).where(eq(aiServiceConfigs.id, body.configId)).limit(1))[0]
      : await getActiveConfig(body.serviceType)

    if (!config) return jsonFail(c, '未找到可用配置，请先添加并设为默认')

    if (body.serviceType === 'text') {
      const model = body.configId
        ? createTextModelFromConfig(config)
        : await createTextModel()
      const { text } = await generateText({ model, prompt: '回复 OK' })
      return jsonOk(c, { ok: true, message: text.slice(0, 50) || '文本连通性正常' })
    }

    if (!config.baseUrl?.trim()) return jsonFail(c, '配置缺少 Base URL')
    if (!config.apiKey?.trim()) return jsonFail(c, '配置缺少 API Key')
    if (!config.model?.trim()) return jsonFail(c, '配置缺少模型名称')

    if (body.serviceType === 'image') {
      try {
        const adapter = getImageAdapter(config.provider || 'openai')
        await Promise.race([
          adapter.generate({ prompt: 'solid blue square, minimal', config }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('[TIMEOUT] 图片连通性测试超时')), 60000)
          }),
        ])
        return jsonOk(c, { ok: true, message: '图片生成连通性正常' })
      } catch (err) {
        return jsonFail(c, classifyTestError(err))
      }
    }

    if (body.serviceType === 'video') {
      try {
        const base = config.baseUrl.replace(/\/+$/, '')
        const res = await fetchWithTimeout(base, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            Accept: 'application/json',
          },
        }, 15000)
        if (res.status === 401 || res.status === 403) {
          return jsonFail(c, 'Key 被拒绝，请检查 API Key')
        }
        if (res.status === 200 || res.status === 404 || res.status === 405) {
          return jsonOk(c, { ok: true, message: '网络可达，请在生产中验证生成' })
        }
        return jsonOk(c, {
          ok: true,
          message: `网络可达（HTTP ${res.status}），请在生产中验证生成`,
        })
      } catch (err) {
        return jsonFail(c, classifyTestError(err))
      }
    }

    if (body.serviceType === 'tts') {
      if (!config.baseUrl?.trim() || !config.apiKey?.trim()) {
        return jsonFail(c, 'TTS 配置缺少 Base URL 或 API Key')
      }
      return jsonOk(c, { ok: true, message: 'TTS 配置字段校验通过，请在工作台验证旁白生成' })
    }

    return jsonOk(c, {
      ok: true,
      message: '配置字段校验通过，请在生产任务中验证生成',
    })
  } catch (err) {
    return jsonFail(c, classifyTestError(err))
  }
})
