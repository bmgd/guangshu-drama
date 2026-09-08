import { and, eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import {
  mediaVersions,
  characters,
  scenes,
  props,
  storyboards,
} from '../db/schema.js'

export type MediaEntityType = 'character' | 'scene' | 'prop' | 'storyboard'
export type MediaField = 'imageUrl' | 'videoUrl' | 'audioUrl' | 'firstFrameImage' | 'lastFrameImage'

/** 覆盖媒体 URL 前归档旧版本 */
export async function pushMediaVersion(params: {
  entityType: MediaEntityType
  entityId: number
  field: MediaField
  url: string | null | undefined
  localPath?: string | null
}) {
  if (!params.url) return null
  const [row] = await db.insert(mediaVersions).values({
    entityType: params.entityType,
    entityId: params.entityId,
    field: params.field,
    url: params.url,
    localPath: params.localPath ?? null,
    createdAt: nowIso(),
  }).returning()
  return row
}

export async function listMediaVersions(entityType: string, entityId: number, field?: string) {
  let rows = await db.select().from(mediaVersions)
    .where(and(
      eq(mediaVersions.entityType, entityType),
      eq(mediaVersions.entityId, entityId),
    ))
  if (field) rows = rows.filter((r) => r.field === field)
  return rows.sort((a, b) => b.id - a.id)
}

export async function restoreMediaVersion(versionId: number) {
  const rows = await db.select().from(mediaVersions).where(eq(mediaVersions.id, versionId)).limit(1)
  const ver = rows[0]
  if (!ver) throw new Error('版本不存在')

  const now = nowIso()
  const { entityType, entityId, field, url, localPath } = ver

  if (entityType === 'character' && field === 'imageUrl') {
    await db.update(characters).set({ imageUrl: url, localPath: localPath || undefined, updatedAt: now })
      .where(eq(characters.id, entityId))
  } else if (entityType === 'scene' && field === 'imageUrl') {
    await db.update(scenes).set({ imageUrl: url, localPath: localPath || undefined, updatedAt: now })
      .where(eq(scenes.id, entityId))
  } else if (entityType === 'prop' && field === 'imageUrl') {
    await db.update(props).set({ imageUrl: url, localPath: localPath || undefined, updatedAt: now })
      .where(eq(props.id, entityId))
  } else if (entityType === 'storyboard') {
    if (field === 'firstFrameImage') {
      await db.update(storyboards).set({ firstFrameImage: url, updatedAt: now }).where(eq(storyboards.id, entityId))
    } else if (field === 'videoUrl') {
      await db.update(storyboards).set({ videoUrl: url, updatedAt: now }).where(eq(storyboards.id, entityId))
    } else if (field === 'audioUrl') {
      await db.update(storyboards).set({ audioUrl: url, updatedAt: now }).where(eq(storyboards.id, entityId))
    } else {
      throw new Error(`不支持恢复字段: ${field}`)
    }
  } else {
    throw new Error(`不支持恢复: ${entityType}.${field}`)
  }

  return ver
}
