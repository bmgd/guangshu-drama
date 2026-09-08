import { Hono } from 'hono'
import { jsonOk, jsonFail } from '../utils/response.js'
import { sumByDrama, sumGlobal, recordUsage } from '../services/usage.js'
import { db } from '../db/index.js'
import { usageRecords } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

export const usageRouter = new Hono()

usageRouter.get('/', async (c) => {
  const dramaId = c.req.query('dramaId')
  if (dramaId) {
    const summary = await sumByDrama(Number(dramaId))
    const rows = await db.select().from(usageRecords)
      .where(eq(usageRecords.dramaId, Number(dramaId)))
      .orderBy(desc(usageRecords.id))
    return jsonOk(c, { ...summary, records: rows.slice(0, 200) })
  }
  const rows = await db.select().from(usageRecords).orderBy(desc(usageRecords.id)).limit(200)
  return jsonOk(c, { records: rows })
})

usageRouter.get('/summary', async (c) => {
  const dramaId = c.req.query('dramaId')
  if (dramaId) return jsonOk(c, await sumByDrama(Number(dramaId)))
  return jsonOk(c, await sumGlobal())
})

/** 可选：手动记账（调试 / 外部接入） */
usageRouter.post('/', async (c) => {
  const body = await c.req.json<{
    dramaId?: number
    episodeId?: number
    taskId?: number
    serviceType: string
    provider?: string
    model?: string
    unitType: string
    units: number
    estimatedCost?: number
    configId?: number
  }>()
  if (!body.serviceType || body.units == null) return jsonFail(c, '参数不完整')
  try {
    const row = await recordUsage(body)
    return jsonOk(c, row, 201)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '记账失败')
  }
})
