import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { storyboards, characters } from '../db/schema.js'

export async function assembleVideoPrompt(storyboardId: number) {
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, storyboardId)).limit(1)
  const sb = rows[0]
  if (!sb) return ''
  const parts = [
    sb.videoPrompt,
    sb.shotType ? `shot: ${sb.shotType}` : '',
    sb.movement ? `camera movement: ${sb.movement}` : '',
    sb.atmosphere ? `atmosphere: ${sb.atmosphere}` : '',
    sb.description ? `action: ${sb.description}` : '',
  ].filter(Boolean)
  return parts.join(', ')
}

export async function getCharacterReferenceNames(_storyboardId: number) {
  const links = await db.select().from(characters)
  return links.map((c) => c.name).filter(Boolean)
}
