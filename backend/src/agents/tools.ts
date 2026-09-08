import { tool } from 'ai'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { characters, scenes, props, episodes, storyboards } from '../db/schema.js'
import { persistExtraction } from '../services/extraction.js'

export function createDramaTools(ctx: { dramaId?: number; episodeId?: number }) {
  return {
    queryCharacters: tool({
      description: '查询当前剧集的角色列表',
      parameters: z.object({}),
      execute: async () => {
        if (!ctx.dramaId) return { error: '缺少 dramaId' }
        const rows = await db.select().from(characters).where(
          and(eq(characters.dramaId, ctx.dramaId), isNull(characters.deletedAt)),
        )
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          description: r.description,
          appearance: r.appearance,
          personality: r.personality,
          imageUrl: r.imageUrl,
        }))
      },
    }),

    queryScenes: tool({
      description: '查询当前剧集的场景列表',
      parameters: z.object({}),
      execute: async () => {
        if (!ctx.dramaId) return { error: '缺少 dramaId' }
        const rows = await db.select().from(scenes).where(
          and(eq(scenes.dramaId, ctx.dramaId), isNull(scenes.deletedAt)),
        )
        return rows.map((r) => ({
          id: r.id,
          location: r.location,
          time: r.time,
          prompt: r.prompt,
          lighting: r.lighting,
          imageUrl: r.imageUrl,
        }))
      },
    }),

    queryProps: tool({
      description: '查询当前剧集的道具列表',
      parameters: z.object({}),
      execute: async () => {
        if (!ctx.dramaId) return { error: '缺少 dramaId' }
        const rows = await db.select().from(props).where(
          and(eq(props.dramaId, ctx.dramaId), isNull(props.deletedAt)),
        )
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          description: r.description,
          prompt: r.prompt,
          imageUrl: r.imageUrl,
        }))
      },
    }),

    readScript: tool({
      description: '读取当前集的剧本文本',
      parameters: z.object({}),
      execute: async () => {
        if (!ctx.episodeId) return { error: '缺少 episodeId' }
        const rows = await db.select().from(episodes).where(
          and(eq(episodes.id, ctx.episodeId), isNull(episodes.deletedAt)),
        ).limit(1)
        const ep = rows[0]
        if (!ep) return { error: '分集不存在' }
        return {
          id: ep.id,
          title: ep.title,
          episodeNumber: ep.episodeNumber,
          scriptContent: ep.scriptContent || '',
          content: ep.content || '',
        }
      },
    }),

    saveScript: tool({
      description: '保存改写后的剧本到当前集',
      parameters: z.object({
        script: z.string(),
        title: z.string().optional(),
      }),
      execute: async ({ script, title }) => {
        if (!ctx.episodeId) return { error: '缺少 episodeId' }
        const patch: {
          scriptContent: string
          updatedAt: string
          title?: string
        } = {
          scriptContent: script,
          updatedAt: nowIso(),
        }
        if (title) patch.title = title
        await db.update(episodes).set(patch).where(eq(episodes.id, ctx.episodeId))
        return { ok: true, episodeId: ctx.episodeId }
      },
    }),

    listStoryboards: tool({
      description: '列出当前集的分镜列表',
      parameters: z.object({}),
      execute: async () => {
        if (!ctx.episodeId) return { error: '缺少 episodeId' }
        const rows = await db.select().from(storyboards).where(
          and(eq(storyboards.episodeId, ctx.episodeId), isNull(storyboards.deletedAt)),
        )
        return rows
          .sort((a, b) => a.storyboardNumber - b.storyboardNumber)
          .map((r) => ({
            id: r.id,
            storyboardNumber: r.storyboardNumber,
            title: r.title,
            shotType: r.shotType,
            description: r.description,
            duration: r.duration,
            status: r.status,
          }))
      },
    }),

    rewriteScriptTool: tool({
      description: '将原文/梗概改写为短剧剧本并保存到当前集',
      parameters: z.object({
        content: z.string().optional().describe('原文内容；缺省则使用当前集 content'),
        genre: z.string().optional(),
      }),
      execute: async ({ content, genre }) => {
        if (!ctx.episodeId) return { error: '缺少 episodeId' }
        const rows = await db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).limit(1)
        const ep = rows[0]
        if (!ep) return { error: '分集不存在' }
        const source = (content || ep.content || '').trim()
        if (!source) return { error: '缺少可改写内容' }
        const { rewriteScript } = await import('./index.js')
        const result = await rewriteScript({ content: source, genre })
        await db.update(episodes).set({
          scriptContent: result.script,
          title: result.title || ep.title,
          updatedAt: nowIso(),
        }).where(eq(episodes.id, ctx.episodeId))
        return { ok: true, title: result.title, summary: result.summary, scriptLength: result.script.length }
      },
    }),

    generateScriptTool: tool({
      description: '根据创意大纲从零创作短剧剧本（非润色）并保存到当前集',
      parameters: z.object({
        brief: z.string().optional().describe('创意大纲；缺省使用当前集 content'),
        genre: z.string().optional(),
        episodeCount: z.number().optional(),
      }),
      execute: async ({ brief, genre, episodeCount }) => {
        if (!ctx.episodeId) return { error: '缺少 episodeId' }
        const rows = await db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).limit(1)
        const ep = rows[0]
        if (!ep) return { error: '分集不存在' }
        const source = (brief || ep.content || '').trim()
        if (!source) return { error: '缺少创意大纲' }
        const { generateScriptFromBrief } = await import('./index.js')
        const result = await generateScriptFromBrief({ brief: source, genre, episodeCount })
        await db.update(episodes).set({
          scriptContent: result.script,
          title: result.title || ep.title,
          content: source,
          updatedAt: nowIso(),
        }).where(eq(episodes.id, ctx.episodeId))
        return { ok: true, title: result.title, summary: result.summary, scriptLength: result.script.length }
      },
    }),

    extractElementsTool: tool({
      description: '从当前集剧本提取角色/场景/道具并持久化',
      parameters: z.object({
        script: z.string().optional().describe('剧本内容；缺省使用当前集 scriptContent'),
      }),
      execute: async ({ script }) => {
        if (!ctx.episodeId) return { error: '缺少 episodeId' }
        if (!ctx.dramaId) return { error: '缺少 dramaId' }
        const rows = await db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).limit(1)
        const ep = rows[0]
        const text = (script || ep?.scriptContent || '').trim()
        if (!text) return { error: '请先完成剧本改写' }
        const { extractElements } = await import('./index.js')
        const result = await extractElements(text)
        const stats = await persistExtraction(ctx.dramaId, ctx.episodeId, result)
        return { ok: true, stats, counts: {
          characters: result.characters.length,
          scenes: result.scenes.length,
          props: result.props.length,
        } }
      },
    }),

    breakStoryboardTool: tool({
      description: '将剧本拆解为分镜并写入数据库；replace=true 时软删除旧分镜',
      parameters: z.object({
        script: z.string().optional().describe('剧本内容；缺省使用当前集 scriptContent'),
        replace: z.boolean().optional().describe('是否替换已有分镜，默认 false'),
      }),
      execute: async ({ script, replace }) => {
        if (!ctx.episodeId) return { error: '缺少 episodeId' }
        const rows = await db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).limit(1)
        const ep = rows[0]
        const text = (script || ep?.scriptContent || '').trim()
        if (!text) return { error: '请先完成剧本改写' }
        const { breakStoryboard } = await import('./index.js')
        const result = await breakStoryboard(text)
        if (replace) {
          const existing = await db.select().from(storyboards).where(eq(storyboards.episodeId, ctx.episodeId))
          for (const sb of existing) {
            if (!sb.deletedAt && !sb.locked) {
              await db.update(storyboards).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(storyboards.id, sb.id))
            }
          }
        }
        const now = nowIso()
        const created = []
        const { linkStoryboardCharacters } = await import('../services/storyboard-links.js')
        for (const item of result.storyboards) {
          const [row] = await db.insert(storyboards).values({
            episodeId: ctx.episodeId,
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
          if (ctx.dramaId && item.characterNames?.length) {
            await linkStoryboardCharacters(row.id, item.characterNames, ctx.dramaId)
          }
          created.push({ id: row.id, storyboardNumber: row.storyboardNumber })
        }
        return { ok: true, count: created.length, storyboards: created }
      },
    }),
  }
}
