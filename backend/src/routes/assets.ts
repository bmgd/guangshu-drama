import { Hono } from 'hono'
import { eq, isNull } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { assets } from '../db/schema.js'
import { jsonOk } from '../utils/response.js'

export const assetsRouter = new Hono()

assetsRouter.get('/stats', async (c) => {
  const rows = await db.select().from(assets).where(isNull(assets.deletedAt))
  const byType: Record<string, number> = {}
  let storageBytes = 0
  for (const r of rows) {
    const t = r.type || 'unknown'
    byType[t] = (byType[t] || 0) + 1
    storageBytes += r.fileSize || 0
  }
  return jsonOk(c, {
    total: rows.length,
    byType,
    storageBytes,
  })
})

assetsRouter.get('/', async (c) => {
  const dramaId = c.req.query('dramaId')
  const type = c.req.query('type')
  const q = (c.req.query('q') || '').trim().toLowerCase()
  let rows = await db.select().from(assets).where(isNull(assets.deletedAt))
  if (dramaId) rows = rows.filter((r) => r.dramaId === Number(dramaId))
  if (type) rows = rows.filter((r) => r.type === type)
  if (q) {
    rows = rows.filter((r) => {
      const name = (r.name || '').toLowerCase()
      const desc = (r.description || '').toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }
  return jsonOk(c, rows)
})

assetsRouter.put('/:id/favorite', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ isFavorite: boolean }>()
  await db.update(assets).set({ isFavorite: body.isFavorite, updatedAt: nowIso() }).where(eq(assets.id, id))
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1)
  return jsonOk(c, rows[0])
})

assetsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(assets).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(assets.id, id))
  return jsonOk(c, { id })
})
