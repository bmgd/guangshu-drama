import { Hono } from 'hono'
import { jsonOk, jsonFail } from '../utils/response.js'
import { listMediaVersions, restoreMediaVersion } from '../services/media-versions.js'

export const versionsRouter = new Hono()

versionsRouter.get('/', async (c) => {
  const entityType = c.req.query('entityType')
  const entityId = c.req.query('entityId')
  const field = c.req.query('field')
  if (!entityType || !entityId) return jsonFail(c, '需要 entityType 与 entityId')
  const rows = await listMediaVersions(entityType, Number(entityId), field || undefined)
  return jsonOk(c, rows)
})

versionsRouter.post('/:id/restore', async (c) => {
  try {
    const ver = await restoreMediaVersion(Number(c.req.param('id')))
    return jsonOk(c, ver)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '恢复失败')
  }
})
