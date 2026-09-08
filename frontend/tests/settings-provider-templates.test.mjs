import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('settings.vue has minimax and volcengine template strings', () => {
  const file = join(root, 'app/pages/app/settings.vue')
  assert.ok(existsSync(file), 'settings.vue missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /minimax/i)
  assert.match(src, /volcengine/i)
})
