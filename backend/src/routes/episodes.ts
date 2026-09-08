import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { episodes } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'

export const episodesRouter = new Hono()

episodesRouter.get('/', async (c) => {
  const dramaId = c.req.query('dramaId')
  const rows = dramaId
    ? await db.select().from(episodes).where(and(eq(episodes.dramaId, Number(dramaId)), isNull(episodes.deletedAt)))
    : await db.select().from(episodes).where(isNull(episodes.deletedAt))
  return jsonOk(c, rows)
})

episodesRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1)
  const row = rows[0]
  if (!row || row.deletedAt) return jsonFail(c, '集不存在', 404)
  return jsonOk(c, row)
})

episodesRouter.post('/', async (c) => {
  const body = await c.req.json<{
    dramaId: number
    episodeNumber: number
    title: string
    content?: string
    description?: string
    resolution?: string
  }>()
  if (!body.dramaId || !body.title) return jsonFail(c, '参数不完整')
  const now = nowIso()
  const [row] = await db.insert(episodes).values({
    dramaId: body.dramaId,
    episodeNumber: body.episodeNumber || 1,
    title: body.title,
    content: body.content || null,
    description: body.description || null,
    resolution: body.resolution || '720p',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, row, 201)
})

episodesRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof episodes.$inferInsert>>()
  const existingRows = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1)
  const existing = existingRows[0]
  if (!existing || existing.deletedAt) return jsonFail(c, '集不存在', 404)
  await db.update(episodes).set({ ...body, updatedAt: nowIso() }).where(eq(episodes.id, id))
  const rows = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1)
  return jsonOk(c, rows[0])
})

episodesRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(episodes).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(episodes.id, id))
  return jsonOk(c, { id })
})
