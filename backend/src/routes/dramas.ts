import { Hono } from 'hono'
import { eq, isNull, desc } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { dramas } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'

export const dramasRouter = new Hono()

dramasRouter.get('/', async (c) => {
  const rows = await db.select().from(dramas).where(isNull(dramas.deletedAt)).orderBy(desc(dramas.updatedAt))
  return jsonOk(c, rows)
})

dramasRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(dramas).where(eq(dramas.id, id)).limit(1)
  const row = rows[0]
  if (!row || row.deletedAt) return jsonFail(c, '剧集不存在', 404)
  return jsonOk(c, row)
})

dramasRouter.post('/', async (c) => {
  const body = await c.req.json<{
    title: string
    description?: string
    genre?: string
    style?: string
    aspectRatio?: string
    totalEpisodes?: number
    tags?: string[]
    contentSource?: string
    creationType?: string
    generationMode?: string
  }>()
  if (!body.title?.trim()) return jsonFail(c, '标题不能为空')
  const now = nowIso()
  const [row] = await db.insert(dramas).values({
    title: body.title.trim(),
    description: body.description || null,
    genre: body.genre || null,
    style: body.style || '3d',
    aspectRatio: body.aspectRatio || '16:9',
    totalEpisodes: body.totalEpisodes || 1,
    tags: body.tags ? JSON.stringify(body.tags) : null,
    contentSource: body.contentSource || 'novel',
    creationType: body.creationType || 'drama',
    generationMode: body.generationMode || 'storyboard',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, row, 201)
})

dramasRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof dramas.$inferInsert>>()
  const existingRows = await db.select().from(dramas).where(eq(dramas.id, id)).limit(1)
  const existing = existingRows[0]
  if (!existing || existing.deletedAt) return jsonFail(c, '剧集不存在', 404)
  await db.update(dramas).set({
    ...body,
    tags: body.tags ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)) : existing.tags,
    updatedAt: nowIso(),
  }).where(eq(dramas.id, id))
  const rows = await db.select().from(dramas).where(eq(dramas.id, id)).limit(1)
  return jsonOk(c, rows[0])
})

dramasRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(dramas).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(dramas.id, id))
  return jsonOk(c, { id })
})
