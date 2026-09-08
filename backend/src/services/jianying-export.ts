/**
 * 剪映草稿导出
 *
 * 草稿目录布局：
 *   {name}/
 *     draft_info.json     （剪映 6+）或 draft_content.json（5.x）
 *     draft_meta_info.json
 *     assets/segment_N.mp4
 *
 * 生成的 JSON 为简化草稿：含 id、画布、materials.videos、
 * tracks（视频轨片段 path + duration 微秒），足以让剪映识别并打开时间线。
 */

import { mkdirSync, existsSync, copyFileSync, createWriteStream, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, nowIso } from '../db/index.js'
import { storyboards, episodes, dramas } from '../db/schema.js'
import { getStorageRoot, staticUrl, ensureStorage } from '../utils/storage.js'
import { probeVideo } from '../utils/ffmpeg.js'

const require = createRequire(import.meta.url)
const archiver = require('archiver') as (
  format: string,
  options?: { zlib?: { level: number } },
) => {
  pipe(stream: NodeJS.WritableStream): unknown
  directory(dirpath: string, destpath: string | false): unknown
  finalize(): void
  on(event: 'error', listener: (err: Error) => void): unknown
}

function us(seconds: number) {
  return Math.round(Math.max(seconds, 0.1) * 1_000_000)
}

function buildDraftMeta(name: string, createTimeMs: number) {
  // 光束原创简化草稿 — draft_meta_info
  return {
    draft_name: name,
    draft_id: uuidv4(),
    tm_draft_create: createTimeMs,
    tm_draft_modified: createTimeMs,
    draft_fold_path: '',
    draft_root_path: '',
    draft_removable_storage_device: '',
    draft_is_ai_shorts: false,
  }
}

function buildDraftInfo(opts: {
  name: string
  width: number
  height: number
  segments: Array<{ id: string; path: string; durationUs: number; startUs: number }>
}) {
  // 光束原创简化草稿 — materials.videos + tracks
  const materials = {
    videos: opts.segments.map((s) => ({
      id: s.id,
      path: s.path,
      type: 'video',
      duration: s.durationUs,
      width: opts.width,
      height: opts.height,
    })),
  }

  let cursor = 0
  const videoTrackSegments = opts.segments.map((s) => {
    const seg = {
      id: uuidv4(),
      material_id: s.id,
      target_timerange: {
        start: cursor,
        duration: s.durationUs,
      },
      source_timerange: {
        start: 0,
        duration: s.durationUs,
      },
      path: s.path,
    }
    cursor += s.durationUs
    return seg
  })

  return {
    id: uuidv4(),
    name: opts.name,
    // 画布配置（公开已知字段）
    canvas_config: {
      width: opts.width,
      height: opts.height,
      ratio: 'original',
    },
    duration: cursor,
    materials,
    tracks: [
      {
        id: uuidv4(),
        type: 'video',
        segments: videoTrackSegments,
      },
    ],
    version: 360000,
  }
}

async function zipDirectory(sourceDir: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', () => resolve())
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

export async function exportJianyingDraft(episodeId: number, version: '6' | '5' = '6') {
  const epRows = await db.select().from(episodes).where(eq(episodes.id, episodeId)).limit(1)
  const episode = epRows[0]
  if (!episode) throw new Error('分集不存在')

  const dramaRows = await db.select().from(dramas).where(eq(dramas.id, episode.dramaId)).limit(1)
  const drama = dramaRows[0]
  const draftName = `${drama?.title || '光束短剧'}_第${episode.episodeNumber}集`
    .replace(/[^\w\u4e00-\u9fff\-]+/g, '_')

  let boards = await db.select().from(storyboards).where(eq(storyboards.episodeId, episodeId))
  boards = boards
    .filter((b) => !b.deletedAt)
    .sort((a, b) => a.storyboardNumber - b.storyboardNumber)

  const storageRoot = getStorageRoot()
  const segments: Array<{ id: string; path: string; durationUs: number; startUs: number; absSrc: string }> = []
  let startUs = 0

  for (const b of boards) {
    const url = b.composedVideoUrl || b.videoUrl
    if (!url) continue
    const absSrc = join(storageRoot, url.replace('/static/', ''))
    if (!existsSync(absSrc)) continue
    let durationSec = b.duration || 5
    try {
      const probe = await probeVideo(absSrc)
      if (probe.format?.duration) durationSec = Number(probe.format.duration)
    } catch { /* keep fallback */ }
    const durationUs = us(durationSec)
    const id = uuidv4()
    segments.push({
      id,
      path: `assets/segment_${segments.length + 1}.mp4`,
      durationUs,
      startUs,
      absSrc,
    })
    startUs += durationUs
  }

  if (!segments.length) throw new Error('没有可导出的分镜视频')

  ensureStorage()
  const exportsDir = join(storageRoot, 'exports')
  mkdirSync(exportsDir, { recursive: true })

  const workId = `jy_${episodeId}_${uuidv4().slice(0, 8)}`
  const workDir = join(exportsDir, workId)
  const assetsDir = join(workDir, 'assets')
  mkdirSync(assetsDir, { recursive: true })

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    copyFileSync(s.absSrc, join(workDir, s.path))
  }

  const createTimeMs = Date.now()
  const meta = buildDraftMeta(draftName, createTimeMs)
  writeFileSync(join(workDir, 'draft_meta_info.json'), JSON.stringify(meta, null, 2), 'utf8')

  const ratio = drama?.aspectRatio || '16:9'
  const width = ratio === '9:16' ? 1080 : 1920
  const height = ratio === '9:16' ? 1920 : 1080
  const draft = buildDraftInfo({
    name: draftName,
    width,
    height,
    segments: segments.map(({ id, path, durationUs, startUs: su }) => ({ id, path, durationUs, startUs: su })),
  })

  const draftFile = version === '5' ? 'draft_content.json' : 'draft_info.json'
  writeFileSync(join(workDir, draftFile), JSON.stringify(draft, null, 2), 'utf8')

  const zipName = `exports/${workId}.zip`
  const zipPath = join(storageRoot, zipName)
  await zipDirectory(workDir, zipPath)

  // 清理临时目录，保留 zip
  try {
    rmSync(workDir, { recursive: true, force: true })
  } catch { /* ignore */ }

  return {
    url: staticUrl(zipName),
    name: draftName,
    version,
    segmentCount: segments.length,
    createdAt: nowIso(),
  }
}
