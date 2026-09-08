/**
 * Backfill missing image thumbnails and video posters under STORAGE_PATH.
 * Usage: npm run backfill-artwork
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import sharp from 'sharp'
import { extractPosterFrame } from '../src/utils/ffmpeg.js'
import { getStorageRoot, ensureStorage } from '../src/utils/storage.js'

const IMAGE_EXTS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv'])

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function isDerivative(file: string): boolean {
  const base = basename(file)
  return base.includes('_thumb.') || base.includes('_poster.')
}

async function main() {
  ensureStorage()
  const root = process.env.STORAGE_PATH || getStorageRoot()
  console.log(`Scanning ${root}`)

  let thumbsCreated = 0
  let postersCreated = 0
  let thumbsSkipped = 0
  let postersSkipped = 0
  let errors = 0

  const files = walk(root)
  for (const file of files) {
    if (isDerivative(file)) continue
    const ext = extname(file).toLowerCase()

    if (IMAGE_EXTS.has(ext)) {
      const thumb = file.replace(/\.[^.]+$/, '_thumb.webp')
      if (existsSync(thumb)) {
        thumbsSkipped++
        continue
      }
      try {
        await sharp(file).resize(400).webp({ quality: 80 }).toFile(thumb)
        thumbsCreated++
        console.log(`  thumb: ${thumb}`)
      } catch (err) {
        errors++
        console.error(`  thumb failed ${file}:`, err instanceof Error ? err.message : err)
      }
    } else if (VIDEO_EXTS.has(ext)) {
      const poster = file.replace(/\.[^.]+$/, '_poster.jpg')
      if (existsSync(poster)) {
        postersSkipped++
        continue
      }
      try {
        await extractPosterFrame(file, poster)
        postersCreated++
        console.log(`  poster: ${poster}`)
      } catch (err) {
        errors++
        console.error(`  poster failed ${file}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  console.log(
    `Done. thumbsCreated=${thumbsCreated} thumbsSkipped=${thumbsSkipped} ` +
      `postersCreated=${postersCreated} postersSkipped=${postersSkipped} errors=${errors}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
