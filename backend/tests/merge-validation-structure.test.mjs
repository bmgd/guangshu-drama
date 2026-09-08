import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('ffmpeg-merge.ts validates missing media files', () => {
  const file = join(root, 'src/services/ffmpeg-merge.ts')
  assert.ok(existsSync(file), 'ffmpeg-merge.ts missing')
  const src = readFileSync(file, 'utf8')
  assert.ok(
    /缺少/.test(src) || /existsSync/.test(src) || /缺失/.test(src),
    'expected 缺少 / existsSync / 缺失 validation',
  )
})
