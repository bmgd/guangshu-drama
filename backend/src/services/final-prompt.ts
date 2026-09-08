import { eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { dramas, stylePresets, characters, scenes, props, storyboards, episodes } from '../db/schema.js'

export async function getStylePrompt(dramaId: number) {
  const dramaRows = await db.select().from(dramas).where(eq(dramas.id, dramaId)).limit(1)
  const drama = dramaRows[0]
  if (!drama?.style) return ''
  const presetRows = await db.select().from(stylePresets).where(eq(stylePresets.value, drama.style)).limit(1)
  const preset = presetRows[0]
  return preset?.prompt || ''
}

export async function buildFinalPrompt(base: string, dramaId: number) {
  const style = await getStylePrompt(dramaId)
  return style ? `${base}, ${style}` : base
}

export async function applyCharacterPrompt(characterId: number, prompt: string) {
  const rows = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1)
  const char = rows[0]
  if (!char) return
  const finalPrompt = await buildFinalPrompt(prompt, char.dramaId)
  await db.update(characters).set({ finalPrompt, updatedAt: nowIso() }).where(eq(characters.id, characterId))
}

export async function applyScenePrompt(sceneId: number, prompt: string) {
  const rows = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1)
  const scene = rows[0]
  if (!scene) return
  const finalPrompt = await buildFinalPrompt(prompt, scene.dramaId)
  await db.update(scenes).set({ finalPrompt, prompt, updatedAt: nowIso() }).where(eq(scenes.id, sceneId))
}

export async function applyPropPrompt(propId: number, prompt: string) {
  const rows = await db.select().from(props).where(eq(props.id, propId)).limit(1)
  const prop = rows[0]
  if (!prop) return
  const finalPrompt = await buildFinalPrompt(prompt, prop.dramaId)
  await db.update(props).set({ finalPrompt, prompt, updatedAt: nowIso() }).where(eq(props.id, propId))
}

export async function applyStoryboardPrompts(storyboardId: number, imagePrompt?: string, videoPrompt?: string) {
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, storyboardId)).limit(1)
  const sb = rows[0]
  if (!sb) return
  const episodeRows = await db.select().from(episodes).where(eq(episodes.id, sb.episodeId)).limit(1)
  const episode = episodeRows[0]
  const dramaId = episode?.dramaId || 0
  await db.update(storyboards).set({
    imagePrompt: imagePrompt ? await buildFinalPrompt(imagePrompt, dramaId) : sb.imagePrompt,
    videoPrompt: videoPrompt ? await buildFinalPrompt(videoPrompt, dramaId) : sb.videoPrompt,
    updatedAt: nowIso(),
  }).where(eq(storyboards.id, storyboardId))
}
