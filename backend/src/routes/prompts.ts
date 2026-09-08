import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { characters, scenes, props, storyboards } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'
import { generatePrompts } from '../agents/index.js'
import { applyCharacterPrompt, applyScenePrompt, applyPropPrompt, applyStoryboardPrompts, getStylePrompt } from '../services/final-prompt.js'

export const promptsRouter = new Hono()

promptsRouter.post('/generate', async (c) => {
  const body = await c.req.json<{
    type: 'character' | 'scene' | 'prop' | 'storyboard'
    ids: number[]
    dramaId: number
  }>()
  try {
    const stylePrompt = await getStylePrompt(body.dramaId)
    let items: Array<Record<string, unknown>> = []
    if (body.type === 'character') {
      const rows = await Promise.all(body.ids.map(async (id) => {
        const r = await db.select().from(characters).where(eq(characters.id, id)).limit(1)
        return r[0]
      }))
      items = rows.filter(Boolean) as Array<Record<string, unknown>>
    } else if (body.type === 'scene') {
      const rows = await Promise.all(body.ids.map(async (id) => {
        const r = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1)
        return r[0]
      }))
      items = rows.filter(Boolean) as Array<Record<string, unknown>>
    } else if (body.type === 'prop') {
      const rows = await Promise.all(body.ids.map(async (id) => {
        const r = await db.select().from(props).where(eq(props.id, id)).limit(1)
        return r[0]
      }))
      items = rows.filter(Boolean) as Array<Record<string, unknown>>
    } else {
      const rows = await Promise.all(body.ids.map(async (id) => {
        const r = await db.select().from(storyboards).where(eq(storyboards.id, id)).limit(1)
        return r[0]
      }))
      items = rows.filter(Boolean) as Array<Record<string, unknown>>
    }
    const result = await generatePrompts({ type: body.type, items, stylePrompt })
    for (const item of result.items) {
      const id = Number(item.id)
      if (body.type === 'character') await applyCharacterPrompt(id, item.prompt)
      else if (body.type === 'scene') await applyScenePrompt(id, item.prompt)
      else if (body.type === 'prop') await applyPropPrompt(id, item.prompt)
      else if (item.type === 'storyboard_image') await applyStoryboardPrompts(id, item.prompt)
      else if (item.type === 'storyboard_video') await applyStoryboardPrompts(id, undefined, item.prompt)
    }
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '提示词生成失败')
  }
})
