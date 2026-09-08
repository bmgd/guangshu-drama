import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { storyboards } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'
import { computeArtifactStatus } from '../services/artifact-status.js'

function withArtifactStatus<T extends typeof storyboards.$inferSelect>(row: T) {
  return { ...row, artifactStatus: computeArtifactStatus(row) }
}

const MEDIA_FIELDS = new Set([
  'firstFrameImage',
  'lastFrameImage',
  'videoUrl',
  'composedImage',
  'composedVideoUrl',
  'referenceImages',
  'audioUrl',
  'subtitleUrl',
])

function bodyTouchesMedia(body: Record<string, unknown>) {
  return Object.keys(body).some((k) => MEDIA_FIELDS.has(k) && body[k] !== undefined)
}

function isOnlyLockedToggle(body: Record<string, unknown>) {
  const keys = Object.keys(body).filter((k) => body[k] !== undefined)
  return keys.length === 1 && keys[0] === 'locked'
}

export const storyboardsRouter = new Hono()

storyboardsRouter.get('/', async (c) => {
  const episodeId = c.req.query('episodeId')
  const rows = episodeId
    ? await db.select().from(storyboards).where(and(eq(storyboards.episodeId, Number(episodeId)), isNull(storyboards.deletedAt)))
    : await db.select().from(storyboards).where(isNull(storyboards.deletedAt))
  return jsonOk(c, rows.sort((a, b) => a.storyboardNumber - b.storyboardNumber).map(withArtifactStatus))
})

storyboardsRouter.get('/:id', async (c) => {
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, Number(c.req.param('id')))).limit(1)
  const row = rows[0]
  if (!row || row.deletedAt) return jsonFail(c, '分镜不存在', 404)
  return jsonOk(c, withArtifactStatus(row))
})

storyboardsRouter.post('/', async (c) => {
  const body = await c.req.json<Partial<typeof storyboards.$inferInsert> & { episodeId: number; storyboardNumber: number }>()
  if (!body.episodeId || !body.storyboardNumber) return jsonFail(c, '参数不完整')
  const now = nowIso()
  const [row] = await db.insert(storyboards).values({
    episodeId: body.episodeId,
    sceneId: body.sceneId || null,
    storyboardNumber: body.storyboardNumber,
    title: body.title || null,
    location: body.location || null,
    time: body.time || null,
    shotType: body.shotType || null,
    angle: body.angle || null,
    movement: body.movement || null,
    result: body.result || null,
    atmosphere: body.atmosphere || null,
    imagePrompt: body.imagePrompt || null,
    videoPrompt: body.videoPrompt || null,
    description: body.description || null,
    narrationText: body.narrationText || null,
    duration: body.duration || 0,
    locked: false,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, withArtifactStatus(row), 201)
})

storyboardsRouter.post('/batch', async (c) => {
  const body = await c.req.json<{ episodeId: number; items: Array<Partial<typeof storyboards.$inferInsert>> }>()
  if (!body.episodeId || !body.items?.length) return jsonFail(c, '参数不完整')
  const now = nowIso()
  const created = []
  for (const [idx, item] of body.items.entries()) {
    const [row] = await db.insert(storyboards).values({
      episodeId: body.episodeId,
      sceneId: item.sceneId || null,
      storyboardNumber: item.storyboardNumber ?? idx + 1,
      title: item.title || null,
      location: item.location || null,
      time: item.time || null,
      shotType: item.shotType || null,
      angle: item.angle || null,
      movement: item.movement || null,
      result: item.result || null,
      atmosphere: item.atmosphere || null,
      imagePrompt: item.imagePrompt || null,
      videoPrompt: item.videoPrompt || null,
      description: item.description || null,
      narrationText: item.narrationText || null,
      duration: item.duration || 0,
      locked: false,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }).returning()
    created.push(withArtifactStatus(row))
  }
  return jsonOk(c, created, 201)
})

storyboardsRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof storyboards.$inferInsert>>()
  const existingRows = await db.select().from(storyboards).where(eq(storyboards.id, id)).limit(1)
  const existing = existingRows[0]
  if (!existing || existing.deletedAt) return jsonFail(c, '分镜不存在', 404)
  if (existing.locked && bodyTouchesMedia(body as Record<string, unknown>) && !isOnlyLockedToggle(body as Record<string, unknown>)) {
    const unlocking = body.locked === false
    if (!unlocking) {
      return jsonFail(c, '分镜已锁定，无法修改媒体字段；请先解锁')
    }
  }
  await db.update(storyboards).set({ ...body, updatedAt: nowIso() }).where(eq(storyboards.id, id))
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, id)).limit(1)
  return jsonOk(c, withArtifactStatus(rows[0]!))
})

storyboardsRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{
    duration?: number
    imagePrompt?: string
    videoPrompt?: string
    description?: string
    shotType?: string
    movement?: string
    status?: string
    firstFrameImage?: string | null
    lastFrameImage?: string | null
    referenceImages?: string | null
    narrationText?: string | null
    audioUrl?: string | null
    videoUrl?: string | null
    locked?: boolean
  }>()
  const existingRows = await db.select().from(storyboards).where(eq(storyboards.id, id)).limit(1)
  const existing = existingRows[0]
  if (!existing || existing.deletedAt) return jsonFail(c, '分镜不存在', 404)

  if (existing.locked && bodyTouchesMedia(body as Record<string, unknown>)) {
    if (body.locked !== false) {
      return jsonFail(c, '分镜已锁定，无法修改媒体字段；请先解锁')
    }
  }

  await db.update(storyboards).set({
    duration: body.duration !== undefined ? body.duration : existing.duration,
    imagePrompt: body.imagePrompt !== undefined ? body.imagePrompt : existing.imagePrompt,
    videoPrompt: body.videoPrompt !== undefined ? body.videoPrompt : existing.videoPrompt,
    description: body.description !== undefined ? body.description : existing.description,
    shotType: body.shotType !== undefined ? body.shotType : existing.shotType,
    movement: body.movement !== undefined ? body.movement : existing.movement,
    status: body.status !== undefined ? body.status : existing.status,
    firstFrameImage: body.firstFrameImage !== undefined ? body.firstFrameImage : existing.firstFrameImage,
    lastFrameImage: body.lastFrameImage !== undefined ? body.lastFrameImage : existing.lastFrameImage,
    referenceImages: body.referenceImages !== undefined ? body.referenceImages : existing.referenceImages,
    narrationText: body.narrationText !== undefined ? body.narrationText : existing.narrationText,
    audioUrl: body.audioUrl !== undefined ? body.audioUrl : existing.audioUrl,
    videoUrl: body.videoUrl !== undefined ? body.videoUrl : existing.videoUrl,
    locked: body.locked !== undefined ? body.locked : existing.locked,
    updatedAt: nowIso(),
  }).where(eq(storyboards.id, id))
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, id)).limit(1)
  return jsonOk(c, withArtifactStatus(rows[0]!))
})

storyboardsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, id)).limit(1)
  if (rows[0]?.locked) return jsonFail(c, '分镜已锁定，无法删除')
  await db.update(storyboards).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(storyboards.id, id))
  return jsonOk(c, { id })
})
