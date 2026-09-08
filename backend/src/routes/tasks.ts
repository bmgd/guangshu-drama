import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { sysTasks, characters, scenes, props, storyboards } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'
import { submitImageTask, submitVideoTask, submitTtsTask } from '../services/generation.js'
import { listTaskEvents, appendTaskEvent } from '../services/task-events.js'

export type VideoTaskBody = {
  storyboardId: number
  prompt: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  dramaId?: number
  resolution?: string
  duration?: number
  ratio?: string
  seed?: number
  audio?: boolean
  watermark?: boolean
  promptExtend?: boolean
  referenceImages?: string[]
  configId?: number
  idempotencyKey?: string
}

export const tasksRouter = new Hono()

tasksRouter.get('/', async (c) => {
  const dramaId = c.req.query('dramaId')
  const status = c.req.query('status')
  let rows = await db.select().from(sysTasks)
  if (dramaId) rows = rows.filter((r) => r.dramaId === Number(dramaId))
  if (status) rows = rows.filter((r) => r.status === status)
  return jsonOk(c, rows.sort((a, b) => b.id - a.id))
})

tasksRouter.get('/:id', async (c) => {
  const rows = await db.select().from(sysTasks).where(eq(sysTasks.id, Number(c.req.param('id')))).limit(1)
  const row = rows[0]
  if (!row) return jsonFail(c, '任务不存在', 404)
  const events = await listTaskEvents(row.id)
  return jsonOk(c, { ...row, events })
})

async function assertAssetConfirmed(
  type: 'character' | 'scene' | 'prop' | 'storyboard',
  targetId: number,
): Promise<string | null> {
  if (type === 'character') {
    const rows = await db.select().from(characters).where(eq(characters.id, targetId)).limit(1)
    const row = rows[0]
    if (!row) return '角色不存在'
    if (row.reviewStatus !== 'confirmed') return '请先确认该资产后再生成'
  } else if (type === 'scene') {
    const rows = await db.select().from(scenes).where(eq(scenes.id, targetId)).limit(1)
    const row = rows[0]
    if (!row) return '场景不存在'
    if (row.reviewStatus !== 'confirmed') return '请先确认该资产后再生成'
  } else if (type === 'prop') {
    const rows = await db.select().from(props).where(eq(props.id, targetId)).limit(1)
    const row = rows[0]
    if (!row) return '道具不存在'
    if (row.reviewStatus !== 'confirmed') return '请先确认该资产后再生成'
  } else if (type === 'storyboard') {
    const rows = await db.select().from(storyboards).where(eq(storyboards.id, targetId)).limit(1)
    const row = rows[0]
    if (!row) return '分镜不存在'
    if (row.locked) return '分镜已锁定'
  }
  return null
}

tasksRouter.post('/image', async (c) => {
  const body = await c.req.json<{
    type: 'character' | 'scene' | 'prop' | 'storyboard'
    targetId: number
    prompt: string
    dramaId?: number
    configId?: number
    idempotencyKey?: string
    frameType?: 'first' | 'last'
  }>()
  try {
    const err = await assertAssetConfirmed(body.type, body.targetId)
    if (err) return jsonFail(c, err, 400)
    const taskId = await submitImageTask(body)
    return jsonOk(c, { taskId })
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '提交失败')
  }
})

tasksRouter.post('/image/batch', async (c) => {
  const body = await c.req.json<{
    items: Array<{
      type: 'character' | 'scene' | 'prop' | 'storyboard'
      targetId: number
      prompt: string
      dramaId?: number
      configId?: number
      idempotencyKey?: string
      frameType?: 'first' | 'last'
    }>
  }>()
  const taskIds = []
  for (const item of body.items || []) {
    const err = await assertAssetConfirmed(item.type, item.targetId)
    if (err) return jsonFail(c, err, 400)
    taskIds.push(await submitImageTask(item))
  }
  return jsonOk(c, { taskIds })
})

tasksRouter.post('/video', async (c) => {
  const body = await c.req.json<VideoTaskBody>()
  try {
    const err = await assertAssetConfirmed('storyboard', body.storyboardId)
    if (err) return jsonFail(c, err, 400)
    const taskId = await submitVideoTask(body)
    return jsonOk(c, { taskId })
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '提交失败')
  }
})

tasksRouter.post('/video/batch', async (c) => {
  const body = await c.req.json<{ items: VideoTaskBody[] }>()
  const taskIds = []
  for (const item of body.items || []) {
    const err = await assertAssetConfirmed('storyboard', item.storyboardId)
    if (err) return jsonFail(c, err, 400)
    taskIds.push(await submitVideoTask(item))
  }
  return jsonOk(c, { taskIds })
})

tasksRouter.post('/tts', async (c) => {
  const body = await c.req.json<{
    storyboardId: number
    text?: string
    dramaId?: number
    voice?: string
    configId?: number
  }>()
  if (!body.storyboardId) return jsonFail(c, '需要 storyboardId')
  try {
    const err = await assertAssetConfirmed('storyboard', body.storyboardId)
    if (err) return jsonFail(c, err, 400)
    const result = await submitTtsTask(body)
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : 'TTS 失败')
  }
})

tasksRouter.post('/:id/cancel', async (c) => {
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(sysTasks).where(eq(sysTasks.id, id)).limit(1)
  const row = rows[0]
  if (!row) return jsonFail(c, '任务不存在', 404)
  if (row.status !== 'processing' && row.status !== 'pending') {
    return jsonFail(c, '仅处理中或排队中的任务可取消')
  }
  await db.update(sysTasks).set({
    status: 'cancelled',
    progress: row.progress ?? 0,
    updatedAt: nowIso(),
  }).where(eq(sysTasks.id, id))
  await appendTaskEvent(id, 'cancelled', '用户取消', row.progress ?? 0)
  return jsonOk(c, { id, status: 'cancelled' })
})

tasksRouter.post('/:id/retry', async (c) => {
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(sysTasks).where(eq(sysTasks.id, id)).limit(1)
  const row = rows[0]
  if (!row) return jsonFail(c, '任务不存在', 404)
  if (row.status !== 'failed') return jsonFail(c, '仅失败任务可重试')
  await db.update(sysTasks).set({
    status: 'processing',
    errorMsg: null,
    progress: 0,
    updatedAt: nowIso(),
  }).where(eq(sysTasks.id, id))
  await appendTaskEvent(id, 'queued', '重试入队', 0)
  const updated = await db.select().from(sysTasks).where(eq(sysTasks.id, id)).limit(1)
  return jsonOk(c, updated[0])
})
