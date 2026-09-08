import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('ffmpeg-merge has composeStoryboardVideo and mergeEpisodeVideos', () => {
  const file = join(root, 'src/services/ffmpeg-merge.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /composeStoryboardVideo/)
  assert.match(src, /mergeEpisodeVideos/)
})
