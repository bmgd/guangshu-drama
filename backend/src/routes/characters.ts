import { Hono } from 'hono'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { characters, storyboardCharacters, storyboards } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'
import { submitImageTask, submitVideoTask } from '../services/generation.js'
import { v4 as uuidv4 } from 'uuid'

export const charactersRouter = new Hono()

charactersRouter.get('/', async (c) => {
  const dramaId = c.req.query('dramaId')
  const rows = dramaId
    ? await db.select().from(characters).where(and(eq(characters.dramaId, Number(dramaId)), isNull(characters.deletedAt)))
    : await db.select().from(characters).where(isNull(characters.deletedAt))
  return jsonOk(c, rows)
})

charactersRouter.post('/confirm', async (c) => {
  const body = await c.req.json<{ ids: number[] }>()
  const ids = (body.ids || []).filter((id) => Number.isFinite(id))
  if (!ids.length) return jsonFail(c, '需要 ids')
  const now = nowIso()
  await db.update(characters).set({
    reviewStatus: 'confirmed',
    updatedAt: now,
  }).where(inArray(characters.id, ids))
  const rows = await db.select().from(characters).where(inArray(characters.id, ids))
  return jsonOk(c, rows)
})

charactersRouter.get('/:id', async (c) => {
  const rows = await db.select().from(characters).where(eq(characters.id, Number(c.req.param('id')))).limit(1)
  const row = rows[0]
  if (!row || row.deletedAt) return jsonFail(c, '角色不存在', 404)
  return jsonOk(c, row)
})

charactersRouter.post('/:id/cascade-regen', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ includeVideo?: boolean }>().catch(() => ({} as { includeVideo?: boolean }))
  const rows = await db.select().from(characters).where(eq(characters.id, id)).limit(1)
  const char = rows[0]
  if (!char || char.deletedAt) return jsonFail(c, '角色不存在', 404)

  const prompt = (char.finalPrompt || char.appearance || char.description || char.name || '').trim()
  if (!prompt) return jsonFail(c, '角色缺少提示词/外貌描述')

  const batchId = uuidv4().slice(0, 8)
  const charTaskId = await submitImageTask({
    type: 'character',
    targetId: id,
    prompt,
    dramaId: char.dramaId,
    idempotencyKey: `cascade-char-${id}-${batchId}`,
  })

  const links = await db.select().from(storyboardCharacters).where(eq(storyboardCharacters.characterId, id))
  const imageTaskIds: number[] = []
  const videoTaskIds: number[] = []
  let skippedLocked = 0

  for (const link of links) {
    const sbRows = await db.select().from(storyboards).where(eq(storyboards.id, link.storyboardId)).limit(1)
    const sb = sbRows[0]
    if (!sb || sb.deletedAt) continue
    if (sb.locked) {
      skippedLocked++
      continue
    }
    const sbPrompt = sb.imagePrompt || sb.description || prompt
    const imgId = await submitImageTask({
      type: 'storyboard',
      targetId: sb.id,
      prompt: sbPrompt,
      dramaId: char.dramaId,
      frameType: 'first',
      idempotencyKey: `cascade-${id}-${batchId}-${sb.id}`,
    })
    imageTaskIds.push(imgId)

    if (body.includeVideo) {
      const vidPrompt = sb.videoPrompt || sb.imagePrompt || sb.description || ''
      if (vidPrompt && sb.firstFrameImage) {
        const vidId = await submitVideoTask({
          storyboardId: sb.id,
          prompt: vidPrompt,
          firstFrameUrl: sb.firstFrameImage,
          lastFrameUrl: sb.lastFrameImage || undefined,
          dramaId: char.dramaId,
          idempotencyKey: `cascade-vid-${id}-${batchId}-${sb.id}`,
        })
        videoTaskIds.push(vidId)
      }
    }
  }

  return jsonOk(c, {
    batchId,
    characterTaskId: charTaskId,
    storyboardImageTaskIds: imageTaskIds,
    storyboardVideoTaskIds: videoTaskIds,
    skippedLocked,
  })
})

charactersRouter.post('/', async (c) => {
  const body = await c.req.json<Partial<typeof characters.$inferInsert> & { dramaId: number; name: string }>()
  if (!body.dramaId || !body.name) return jsonFail(c, '参数不完整')
  const now = nowIso()
  const [row] = await db.insert(characters).values({
    dramaId: body.dramaId,
    name: body.name,
    role: body.role || null,
    description: body.description || null,
    appearance: body.appearance || null,
    styling: body.styling || null,
    personality: body.personality || null,
    finalPrompt: body.finalPrompt || null,
    imageUrl: body.imageUrl || null,
    referenceImages: body.referenceImages || null,
    sortOrder: body.sortOrder || 0,
    reviewStatus: body.reviewStatus || 'pending_review',
    createdAt: now,
    updatedAt: now,
  }).returning()
  return jsonOk(c, row, 201)
})

charactersRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<typeof characters.$inferInsert>>()
  await db.update(characters).set({ ...body, updatedAt: nowIso() }).where(eq(characters.id, id))
  const rows = await db.select().from(characters).where(eq(characters.id, id)).limit(1)
  return jsonOk(c, rows[0])
})

charactersRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(characters).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(characters.id, id))
  return jsonOk(c, { id })
})
