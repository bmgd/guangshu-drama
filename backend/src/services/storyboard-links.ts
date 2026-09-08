import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { characters, storyboardCharacters } from '../db/schema.js'

/** 按角色名匹配 drama 下角色，写入 storyboard_characters（已存在则跳过） */
export async function linkStoryboardCharacters(
  storyboardId: number,
  names: string[] | undefined | null,
  dramaId: number,
) {
  if (!names?.length || !dramaId) return []
  const allChars = await db.select().from(characters).where(
    and(eq(characters.dramaId, dramaId), isNull(characters.deletedAt)),
  )
  const byName = new Map(allChars.map((c) => [c.name.trim(), c]))
  const linked: number[] = []
  const existing = await db.select().from(storyboardCharacters).where(
    eq(storyboardCharacters.storyboardId, storyboardId),
  )
  const existingSet = new Set(existing.map((r) => r.characterId))

  for (const raw of names) {
    const name = (raw || '').trim()
    if (!name) continue
    const char = byName.get(name)
    if (!char) continue
    if (existingSet.has(char.id)) {
      linked.push(char.id)
      continue
    }
    await db.insert(storyboardCharacters).values({
      storyboardId,
      characterId: char.id,
    })
    existingSet.add(char.id)
    linked.push(char.id)
  }
  return linked
}
