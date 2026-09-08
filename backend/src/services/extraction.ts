import { eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { characters, scenes, props, episodeCharacters, episodeScenes, episodeProps } from '../db/schema.js'
import type { extractElements } from '../agents/index.js'

type ExtractResult = Awaited<ReturnType<typeof extractElements>>

export async function persistExtraction(dramaId: number, episodeId: number, data: ExtractResult) {
  const now = nowIso()
  const charMap = new Map<string, number>()

  for (const item of data.characters) {
    const allChars = await db.select().from(characters).where(eq(characters.dramaId, dramaId))
    const existing = allChars.find((c) => c.name === item.name && !c.deletedAt)
    let charId: number
    if (existing) {
      charId = existing.id
      const descChanged = item.description && item.description !== existing.description
      const appearChanged = item.appearance && item.appearance !== existing.appearance
      await db.update(characters).set({
        role: item.role || existing.role,
        description: item.description || existing.description,
        appearance: item.appearance || existing.appearance,
        personality: item.personality || existing.personality,
        reviewStatus: (descChanged || appearChanged) ? 'pending_review' : existing.reviewStatus,
        updatedAt: now,
      }).where(eq(characters.id, charId))
    } else {
      const [row] = await db.insert(characters).values({
        dramaId,
        name: item.name,
        role: item.role || null,
        description: item.description || null,
        appearance: item.appearance || null,
        personality: item.personality || null,
        reviewStatus: 'pending_review',
        createdAt: now,
        updatedAt: now,
      }).returning()
      charId = row.id
    }
    charMap.set(item.name, charId)
    const links = await db.select().from(episodeCharacters).where(eq(episodeCharacters.episodeId, episodeId))
    const link = links.find((l) => l.characterId === charId)
    if (!link) {
      await db.insert(episodeCharacters).values({ episodeId, characterId: charId, createdAt: now })
    }
  }

  for (const item of data.scenes) {
    const [row] = await db.insert(scenes).values({
      dramaId,
      episodeId,
      location: item.location,
      time: item.time,
      prompt: item.prompt,
      lighting: item.lighting || null,
      status: 'pending',
      reviewStatus: 'pending_review',
      createdAt: now,
      updatedAt: now,
    }).returning()
    await db.insert(episodeScenes).values({ episodeId, sceneId: row.id, createdAt: now })
  }

  for (const item of data.props) {
    const allProps = await db.select().from(props).where(eq(props.dramaId, dramaId))
    const existing = allProps.find((p) => p.name === item.name && !p.deletedAt)
    let propId: number
    if (existing) {
      propId = existing.id
      const descChanged = item.description && item.description !== existing.description
      const promptChanged = item.prompt && item.prompt !== existing.prompt
      await db.update(props).set({
        type: item.type || existing.type,
        description: item.description || existing.description,
        prompt: item.prompt || existing.prompt,
        reviewStatus: (descChanged || promptChanged) ? 'pending_review' : existing.reviewStatus,
        updatedAt: now,
      }).where(eq(props.id, propId))
    } else {
      const [row] = await db.insert(props).values({
        dramaId,
        name: item.name,
        type: item.type || null,
        description: item.description || null,
        prompt: item.prompt || null,
        reviewStatus: 'pending_review',
        createdAt: now,
        updatedAt: now,
      }).returning()
      propId = row.id
    }
    const links = await db.select().from(episodeProps).where(eq(episodeProps.episodeId, episodeId))
    const link = links.find((l) => l.propId === propId)
    if (!link) {
      await db.insert(episodeProps).values({ episodeId, propId, createdAt: now })
    }
  }

  return { characterCount: data.characters.length, sceneCount: data.scenes.length, propCount: data.props.length }
}
