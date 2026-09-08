import { join } from 'node:path'
import { writeFileSync, existsSync } from 'node:fs'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { storyboards, videoMerges, episodes } from '../db/schema.js'
import { mergeVideos, probeVideo, burnSubtitle, muxAudioOntoVideo } from '../utils/ffmpeg.js'
import { getStorageRoot, staticUrl, ensureStorage } from '../utils/storage.js'

function escapeAssText(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N')
}

function buildAssSubtitle(text: string, durationSec: number) {
  const end = Math.max(durationSec || 5, 1)
  const endH = String(Math.floor(end / 3600)).padStart(1, '0')
  const endM = String(Math.floor((end % 3600) / 60)).padStart(2, '0')
  const endS = String(Math.floor(end % 60)).padStart(2, '0')
  const endCs = '00'
  return `[Script Info]
Title: GuangShu Drama
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,PingFang SC,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,40,40,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${endH}:${endM}:${endS}.${endCs},Default,,0,0,0,,${escapeAssText(text)}
`
}

export async function composeStoryboardVideo(storyboardId: number) {
  const rows = await db.select().from(storyboards).where(eq(storyboards.id, storyboardId)).limit(1)
  const sb = rows[0]
  if (!sb?.videoUrl) throw new Error('分镜视频尚未生成')

  ensureStorage()
  const storageRoot = getStorageRoot()
  const sourcePath = join(storageRoot, sb.videoUrl.replace('/static/', ''))
  if (!existsSync(sourcePath)) throw new Error(`分镜 #${sb.storyboardNumber} 视频文件不存在`)

  const subtitleText = (sb.description || sb.title || `镜头 ${sb.storyboardNumber}`).trim()
  const subtitleName = `subtitles/sb_${sb.id}_${uuidv4()}.ass`
  const subtitlePath = join(storageRoot, subtitleName)
  writeFileSync(subtitlePath, buildAssSubtitle(subtitleText, sb.duration || 5), 'utf8')

  const composedName = `videos/composed_${sb.id}_${uuidv4()}.mp4`
  const composedPath = join(storageRoot, composedName)
  await burnSubtitle(sourcePath, subtitlePath, composedPath)

  let finalComposedPath = composedPath
  let finalComposedName = composedName
  if (sb.audioUrl) {
    const audioPath = join(storageRoot, sb.audioUrl.replace('/static/', ''))
    if (existsSync(audioPath)) {
      finalComposedName = `videos/composed_mux_${sb.id}_${uuidv4()}.mp4`
      finalComposedPath = join(storageRoot, finalComposedName)
      await muxAudioOntoVideo(composedPath, audioPath, finalComposedPath)
    }
  }

  const composedUrl = staticUrl(finalComposedName)
  const subtitleUrl = staticUrl(subtitleName)
  const now = nowIso()
  await db.update(storyboards).set({
    composedVideoUrl: composedUrl,
    subtitleUrl,
    status: 'composed',
    updatedAt: now,
  }).where(eq(storyboards.id, storyboardId))

  return { url: composedUrl, subtitleUrl }
}

export async function mergeEpisodeVideos(episodeId: number, storyboardIds?: number[]) {
  let boards = await db.select().from(storyboards).where(eq(storyboards.episodeId, episodeId))
  if (storyboardIds?.length) {
    boards = boards.filter((b) => storyboardIds.includes(b.id))
  }
  boards = boards.sort((a, b) => a.storyboardNumber - b.storyboardNumber)

  if (!boards.length) throw new Error('没有可拼接的分镜')

  const storageRoot = getStorageRoot()
  const missing: number[] = []
  const paths: string[] = []

  for (const b of boards) {
    const url = b.composedVideoUrl || b.videoUrl
    if (!url) {
      missing.push(b.storyboardNumber)
      continue
    }
    const filePath = join(storageRoot, url.replace('/static/', ''))
    if (!existsSync(filePath)) {
      missing.push(b.storyboardNumber)
      continue
    }
    paths.push(filePath)
  }

  if (missing.length) {
    throw new Error(`以下镜头缺少视频文件，无法导出：${missing.map((n) => `#${n}`).join('、')}`)
  }
  if (!paths.length) throw new Error('没有可拼接的视频')

  const outputName = `videos/merged_${uuidv4()}.mp4`
  const outputPath = join(storageRoot, outputName)
  await mergeVideos(paths, outputPath)
  const probe = await probeVideo(outputPath)
  const duration = Math.round(Number(probe.format.duration || 0))
  const mergedUrl = staticUrl(outputName)
  const now = nowIso()
  const episodeRows = await db.select().from(episodes).where(eq(episodes.id, episodeId)).limit(1)
  const episode = episodeRows[0]
  const [row] = await db.insert(videoMerges).values({
    episodeId,
    dramaId: episode?.dramaId || null,
    title: `第${episode?.episodeNumber || ''}集导出`,
    provider: 'ffmpeg',
    model: 'local',
    status: 'completed',
    scenes: JSON.stringify(storyboardIds || boards.map((b) => b.id)),
    mergedUrl,
    duration,
    createdAt: now,
    completedAt: now,
  }).returning()
  await db.update(episodes).set({ videoUrl: mergedUrl, duration, status: 'completed', updatedAt: now }).where(eq(episodes.id, episodeId))
  return { mergeId: row.id, url: mergedUrl, duration }
}
