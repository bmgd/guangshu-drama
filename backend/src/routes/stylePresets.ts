import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { stylePresets } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'

export const stylePresetsRouter = new Hono()

stylePresetsRouter.get('/', async (c) => {
  const rows = await db.select().from(stylePresets).where(eq(stylePresets.isActive, true))
  return jsonOk(c, rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)))
})

stylePresetsRouter.post('/', async (c) => {
  const body = await c.req.json<{ name: string; value: string; prompt: string; description?: string }>()
  if (!body.name || !body.value || !body.prompt) return jsonFail(c, '参数不完整')
  const now = nowIso()
  const [row] = await db.insert(stylePresets).values({
    name: body.name,
    value: body.value,
    prompt: body.prompt,
    description: body.description || null,
    sortOrder: 99,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, row, 201)
})

stylePresetsRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof stylePresets.$inferInsert>>()
  await db.update(stylePresets).set({ ...body, updatedAt: nowIso() }).where(eq(stylePresets.id, id))
  const rows = await db.select().from(stylePresets).where(eq(stylePresets.id, id)).limit(1)
  return jsonOk(c, rows[0])
})
