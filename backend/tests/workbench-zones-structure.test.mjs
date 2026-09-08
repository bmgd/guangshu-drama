import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('episodes/[n].vue has imagePrompt/镜头图, lightbox, completedPhases/retry', () => {
  const file = join(root, '../frontend/app/pages/app/projects/[id]/episodes/[n].vue')
  assert.ok(existsSync(file), 'episode workbench page missing')
  const src = readFileSync(file, 'utf8')
  assert.ok(/imagePrompt/.test(src) || /镜头图/.test(src), 'expected imagePrompt or 镜头图')
  assert.match(src, /lightbox/i)
  assert.ok(/completedPhases/.test(src) || /retry/i.test(src), 'expected completedPhases or retry')
})
