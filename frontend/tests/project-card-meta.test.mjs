import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('ProjectCard has totalEpisodes/集 or updatedAt/相对', () => {
  const file = join(root, 'app/components/layout/ProjectCard.vue')
  assert.ok(existsSync(file), 'ProjectCard.vue missing')
  const src = readFileSync(file, 'utf8')
  assert.ok(
    /totalEpisodes/.test(src) || /集/.test(src) || /updatedAt/.test(src) || /相对|formatRelative|刚刚|分钟前/.test(src),
    'expected totalEpisodes/集 or updatedAt/relative time',
  )
})
