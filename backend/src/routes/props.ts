import { Hono } from 'hono'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { props } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'

export const propsRouter = new Hono()

propsRouter.get('/', async (c) => {
  const dramaId = c.req.query('dramaId')
  const rows = dramaId
    ? await db.select().from(props).where(and(eq(props.dramaId, Number(dramaId)), isNull(props.deletedAt)))
    : await db.select().from(props).where(isNull(props.deletedAt))
  return jsonOk(c, rows)
})

propsRouter.post('/confirm', async (c) => {
  const body = await c.req.json<{ ids: number[] }>()
  const ids = (body.ids || []).filter((id) => Number.isFinite(id))
  if (!ids.length) return jsonFail(c, '需要 ids')
  const now = nowIso()
  await db.update(props).set({
    reviewStatus: 'confirmed',
    updatedAt: now,
  }).where(inArray(props.id, ids))
  const rows = await db.select().from(props).where(inArray(props.id, ids))
  return jsonOk(c, rows)
})

propsRouter.get('/:id', async (c) => {
  const rows = await db.select().from(props).where(eq(props.id, Number(c.req.param('id')))).limit(1)
  const row = rows[0]
  if (!row || row.deletedAt) return jsonFail(c, '道具不存在', 404)
  return jsonOk(c, row)
})

propsRouter.post('/', async (c) => {
  const body = await c.req.json<Partial<typeof props.$inferInsert> & { dramaId: number; name: string }>()
  if (!body.dramaId || !body.name) return jsonFail(c, '参数不完整')
  const now = nowIso()
  const [row] = await db.insert(props).values({
    dramaId: body.dramaId,
    name: body.name,
    type: body.type || null,
    description: body.description || null,
    prompt: body.prompt || null,
    finalPrompt: body.finalPrompt || null,
    imageUrl: body.imageUrl || null,
    referenceImages: body.referenceImages || null,
    reviewStatus: body.reviewStatus || 'pending_review',
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, row, 201)
})

propsRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof props.$inferInsert>>()
  await db.update(props).set({ ...body, updatedAt: nowIso() }).where(eq(props.id, id))
  const rows = await db.select().from(props).where(eq(props.id, id)).limit(1)
  return jsonOk(c, rows[0])
})

propsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(props).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(props.id, id))
  return jsonOk(c, { id })
})
