import { Hono } from 'hono'
import { db } from '../db/index.js'
import { videoMerges } from '../db/schema.js'
import { jsonOk, jsonFail } from '../utils/response.js'
import { composeStoryboardVideo, mergeEpisodeVideos } from '../services/ffmpeg-merge.js'
import { exportJianyingDraft } from '../services/jianying-export.js'

export const mergeRouter = new Hono()

mergeRouter.get('/', async (c) => {
  const episodeId = c.req.query('episodeId')
  let rows = await db.select().from(videoMerges)
  if (episodeId) rows = rows.filter((r) => r.episodeId === Number(episodeId))
  return jsonOk(c, rows)
})

mergeRouter.post('/compose/:storyboardId', async (c) => {
  try {
    const result = await composeStoryboardVideo(Number(c.req.param('storyboardId')))
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '合成失败')
  }
})

mergeRouter.post('/episode/:episodeId', async (c) => {
  const body = await c.req.json<{ storyboardIds?: number[] }>().catch(() => ({ storyboardIds: undefined }))
  try {
    const result = await mergeEpisodeVideos(Number(c.req.param('episodeId')), body.storyboardIds)
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '拼接失败')
  }
})

mergeRouter.post('/jianying/:episodeId', async (c) => {
  const body = await c.req.json<{ version?: '6' | '5' }>().catch(() => ({ version: '6' as const }))
  try {
    const result = await exportJianyingDraft(Number(c.req.param('episodeId')), body.version || '6')
    return jsonOk(c, result)
  } catch (err) {
    return jsonFail(c, err instanceof Error ? err.message : '剪映草稿导出失败')
  }
})
