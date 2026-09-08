import { extractPosterFrame } from './ffmpeg.js'
import { join } from 'node:path'
import { getStorageRoot, staticUrl } from './storage.js'

export async function generateVideoPoster(videoRelativePath: string) {
  const full = join(getStorageRoot(), videoRelativePath.replace(/^\/static\//, ''))
  const posterRel = videoRelativePath.replace(/\.[^.]+$/, '_poster.jpg').replace(/^\/static\//, '')
  const posterFull = join(getStorageRoot(), posterRel)
  await extractPosterFrame(full, posterFull)
  return staticUrl(posterRel)
}
