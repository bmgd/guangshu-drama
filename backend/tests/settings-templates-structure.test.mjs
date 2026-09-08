import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('settings.vue has MiniMax, aliyun, and 快捷/templates', () => {
  const file = join(root, '../frontend/app/pages/app/settings.vue')
  assert.ok(existsSync(file), 'settings.vue missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /MiniMax|minimax/i)
  assert.match(src, /aliyun/i)
  assert.ok(/快捷/.test(src) || /providerTemplates|templates/i.test(src), 'expected 快捷 or templates')
})

test('aiConfigs.ts mentions videoProvider', () => {
  const file = join(root, 'src/routes/aiConfigs.ts')
  assert.ok(existsSync(file), 'aiConfigs.ts missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /videoProvider/)
})
