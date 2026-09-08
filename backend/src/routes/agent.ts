import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { episodes, storyboards } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'
import { rewriteScript, generateScriptFromBrief, extractElements, breakStoryboard, runAgentChat } from '../agents/index.js'
import { persistExtraction } from '../services/extraction.js'
import { linkStoryboardCharacters } from '../services/storyboard-links.js'
import {
  runProducePipeline,
  getProduceCheckpoint,
  type ProducePayload,
} from '../services/produce-pipeline.js'

export const agentRouter = new Hono()

agentRouter.post('/chat', async (c) => {
  const body = await c.req.json<{
    messages: Array<{ role: string; content: string }>
    dramaId?: number
    episodeId?: number
  }>()
  if (!body.messages?.length) return jsonFail(c, 'messages 不能为空')
  try {
    const result = await runAgentChat({
      messages: body.messages.map((m) => ({
        role: (m.role === 'assistant' || m.role === 'system' ? m.role : 'user') as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      dramaId: body.dramaId,
      episodeId: body.episodeId,
    })
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : 'Agent 对话失败')
  }
})

agentRouter.post('/rewrite-script', async (c) => {
  const body = await c.req.json<{ episodeId: number; content: string; genre?: string }>()
  try {
    const result = await rewriteScript({ content: body.content, genre: body.genre })
    await db.update(episodes).set({
      scriptContent: result.script,
      title: result.title || undefined,
      updatedAt: nowIso(),
    }).where(eq(episodes.id, body.episodeId))
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '剧本改写失败')
  }
})

agentRouter.post('/generate-script', async (c) => {
  const body = await c.req.json<{
    episodeId: number
    brief: string
    genre?: string
    episodeCount?: number
  }>()
  if (!body.episodeId || !body.brief?.trim()) return jsonFail(c, '需要 episodeId 与 brief')
  try {
    const result = await generateScriptFromBrief({
      brief: body.brief,
      genre: body.genre,
      episodeCount: body.episodeCount,
    })
    await db.update(episodes).set({
      scriptContent: result.script,
      title: result.title || undefined,
      content: body.brief,
      updatedAt: nowIso(),
    }).where(eq(episodes.id, body.episodeId))
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '从大纲生成剧本失败')
  }
})

agentRouter.post('/extract', async (c) => {
  const body = await c.req.json<{ episodeId: number; dramaId: number; script?: string }>()
  const episodeRows = await db.select().from(episodes).where(eq(episodes.id, body.episodeId)).limit(1)
  const episode = episodeRows[0]
  const script = body.script || episode?.scriptContent
  if (!script) return jsonFail(c, '请先完成剧本改写')
  try {
    const result = await extractElements(script)
    const stats = await persistExtraction(body.dramaId, body.episodeId, result)
    return jsonOk(c, { ...result, stats })
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '元素提取失败')
  }
})

agentRouter.post('/storyboard', async (c) => {
  const body = await c.req.json<{ episodeId: number; dramaId?: number; script?: string; replace?: boolean }>()
  const episodeRows = await db.select().from(episodes).where(eq(episodes.id, body.episodeId)).limit(1)
  const episode = episodeRows[0]
  const script = body.script || episode?.scriptContent
  if (!script) return jsonFail(c, '请先完成剧本改写')
  const dramaId = body.dramaId ?? episode?.dramaId
  try {
    const result = await breakStoryboard(script)
    if (body.replace) {
      const existing = await db.select().from(storyboards).where(eq(storyboards.episodeId, body.episodeId))
      for (const sb of existing) {
        if (sb.locked) continue
        await db.update(storyboards).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(storyboards.id, sb.id))
      }
    }
    const now = nowIso()
    const created = []
    for (const item of result.storyboards) {
      const [row] = await db.insert(storyboards).values({
        episodeId: body.episodeId,
        storyboardNumber: item.storyboardNumber,
        title: item.title || null,
        location: item.location || null,
        time: item.time || null,
        shotType: item.shotType || null,
        angle: item.angle || null,
        movement: item.movement || null,
        result: item.result || null,
        atmosphere: item.atmosphere || null,
        description: item.description || null,
        duration: item.duration || 0,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }).returning()
      if (dramaId && item.characterNames?.length) {
        await linkStoryboardCharacters(row.id, item.characterNames, dramaId)
      }
      created.push(row)
    }
    return jsonOk(c, { storyboards: created })
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '分镜拆解失败')
  }
})

agentRouter.get('/produce-checkpoint', async (c) => {
  const episodeId = Number(c.req.query('episodeId'))
  if (!Number.isFinite(episodeId)) return jsonFail(c, '需要 episodeId')
  const row = await getProduceCheckpoint(episodeId)
  return jsonOk(c, row)
})

agentRouter.post('/produce', async (c) => {
  const body = await c.req.json<ProducePayload>()
  if (!body.episodeId || !body.dramaId) return jsonFail(c, '需要 episodeId 与 dramaId')
  return streamSSE(c, async (stream) => {
    const send = async (step: string, message: string, data?: unknown) => {
      await stream.writeSSE({ event: 'progress', data: JSON.stringify({ step, message, data }) })
    }
    try {
      const result = await runProducePipeline(body, async (ev) => {
        await send(ev.step, ev.message, ev.data)
      })
      if (result.paused) {
        // 已发送 await_confirm，干净结束流
        return
      }
    } catch (err) {
      await send('error', err instanceof Error ? err.message : '生产流水线失败')
    }
  })
})

agentRouter.post('/pipeline', async (c) => {
  const body = await c.req.json<{ episodeId: number; dramaId: number; content: string; genre?: string }>()
  return streamSSE(c, async (stream) => {
    const send = async (step: string, message: string, data?: unknown) => {
      await stream.writeSSE({ event: 'progress', data: JSON.stringify({ step, message, data }) })
    }
    try {
      await send('rewrite', '正在改写剧本...')
      const script = await rewriteScript({ content: body.content, genre: body.genre })
      await db.update(episodes).set({ scriptContent: script.script, updatedAt: nowIso() }).where(eq(episodes.id, body.episodeId))
      await send('rewrite', '剧本改写完成', script)

      await send('extract', '正在提取角色/场景/道具...')
      const extracted = await extractElements(script.script)
      const stats = await persistExtraction(body.dramaId, body.episodeId, extracted)
      await send('extract', '元素提取完成', { stats, extracted })

      await send('storyboard', '正在拆解分镜...')
      const boards = await breakStoryboard(script.script)
      const now = nowIso()
      for (const item of boards.storyboards) {
        const [row] = await db.insert(storyboards).values({
          episodeId: body.episodeId,
          storyboardNumber: item.storyboardNumber,
          title: item.title || null,
          location: item.location || null,
          time: item.time || null,
          shotType: item.shotType || null,
          angle: item.angle || null,
          movement: item.movement || null,
          result: item.result || null,
          atmosphere: item.atmosphere || null,
          description: item.description || null,
          duration: item.duration || 0,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        }).returning()
        if (item.characterNames?.length) {
          await linkStoryboardCharacters(row.id, item.characterNames, body.dramaId)
        }
      }
      await send('storyboard', '分镜拆解完成', boards)
      await send('done', '流水线执行完成')
    } catch (err) {
      await send('error', err instanceof Error ? err.message : '流水线执行失败')
    }
  })
})
