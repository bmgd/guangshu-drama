import { Hono } from 'hono'
import { eq, isNull, inArray } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { scenes } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'

export const scenesRouter = new Hono()

scenesRouter.get('/', async (c) => {
  const dramaId = c.req.query('dramaId')
  const episodeId = c.req.query('episodeId')
  let rows = await db.select().from(scenes).where(isNull(scenes.deletedAt))
  if (dramaId) rows = rows.filter((r) => r.dramaId === Number(dramaId))
  if (episodeId) rows = rows.filter((r) => r.episodeId === Number(episodeId))
  return jsonOk(c, rows)
})

scenesRouter.post('/confirm', async (c) => {
  const body = await c.req.json<{ ids: number[] }>()
  const ids = (body.ids || []).filter((id) => Number.isFinite(id))
  if (!ids.length) return jsonFail(c, '需要 ids')
  const now = nowIso()
  await db.update(scenes).set({
    reviewStatus: 'confirmed',
    updatedAt: now,
  }).where(inArray(scenes.id, ids))
  const rows = await db.select().from(scenes).where(inArray(scenes.id, ids))
  return jsonOk(c, rows)
})

scenesRouter.get('/:id', async (c) => {
  const rows = await db.select().from(scenes).where(eq(scenes.id, Number(c.req.param('id')))).limit(1)
  const row = rows[0]
  if (!row || row.deletedAt) return jsonFail(c, '场景不存在', 404)
  return jsonOk(c, row)
})

scenesRouter.post('/', async (c) => {
  const body = await c.req.json<{
    dramaId: number
    episodeId?: number
    location: string
    time: string
    prompt: string
    lighting?: string
  }>()
  if (!body.dramaId || !body.location || !body.time || !body.prompt) return jsonFail(c, '参数不完整')
  const now = nowIso()
  const [row] = await db.insert(scenes).values({
    dramaId: body.dramaId,
    episodeId: body.episodeId || null,
    location: body.location,
    time: body.time,
    prompt: body.prompt,
    lighting: body.lighting || null,
    status: 'pending',
    reviewStatus: 'pending_review',
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, row, 201)
})

scenesRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof scenes.$inferInsert>>()
  await db.update(scenes).set({ ...body, updatedAt: nowIso() }).where(eq(scenes.id, id))
  const rows = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1)
  return jsonOk(c, rows[0])
})

scenesRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(scenes).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(scenes.id, id))
  return jsonOk(c, { id })
})
