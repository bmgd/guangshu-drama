import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { join, extname } from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

const storageRoot = process.env.STORAGE_PATH || './data/static'

export function ensureStorage() {
  mkdirSync(storageRoot, { recursive: true })
  mkdirSync(join(storageRoot, 'images'), { recursive: true })
  mkdirSync(join(storageRoot, 'videos'), { recursive: true })
  mkdirSync(join(storageRoot, 'uploads'), { recursive: true })
  mkdirSync(join(storageRoot, 'subtitles'), { recursive: true })
  mkdirSync(join(storageRoot, 'audio'), { recursive: true })
  mkdirSync(join(storageRoot, 'exports'), { recursive: true })
}

export function staticUrl(relativePath: string) {
  return `/static/${relativePath.replace(/^\/+/, '')}`
}

export function saveBuffer(buffer: Buffer, subdir: string, ext: string) {
  ensureStorage()
  const filename = `${uuidv4()}${ext}`
  const relative = join(subdir, filename)
  const full = join(storageRoot, relative)
  writeFileSync(full, buffer)
  return { relative, full, url: staticUrl(relative) }
}

export async function saveImageWithThumb(buffer: Buffer, subdir = 'images') {
  const saved = saveBuffer(buffer, subdir, '.webp')
  const thumbName = saved.relative.replace(/\.[^.]+$/, '_thumb.webp')
  const thumbFull = join(storageRoot, thumbName)
  await sharp(saved.full).resize(400).webp({ quality: 80 }).toFile(thumbFull)
  return {
    ...saved,
    thumbUrl: staticUrl(thumbName),
    thumbPath: thumbFull,
  }
}

export function resolveStaticPath(relativeOrUrl: string) {
  if (relativeOrUrl.startsWith('/static/')) {
    return join(storageRoot, relativeOrUrl.replace('/static/', ''))
  }
  if (!relativeOrUrl.startsWith('http')) {
    return join(storageRoot, relativeOrUrl)
  }
  return relativeOrUrl
}

export function readLocalFile(relativeOrUrl: string) {
  const path = resolveStaticPath(relativeOrUrl)
  if (!existsSync(path)) return null
  return readFileSync(path)
}

export function deleteLocalFile(relativeOrUrl: string) {
  const path = resolveStaticPath(relativeOrUrl)
  if (existsSync(path)) unlinkSync(path)
}

export function getStorageRoot() {
  return storageRoot
}

export function guessExt(mime: string) {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'text/plain': '.txt',
  }
  return map[mime] || extname(mime) || '.bin'
}
