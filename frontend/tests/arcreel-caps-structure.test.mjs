import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('create project form exposes creationType', () => {
  const file = join(root, 'app/pages/app/projects/index.vue')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /creationType/)
  assert.match(src, /contentSource/)
  assert.match(src, /generationMode/)
})

test('workbench has jianying export and narration TTS', () => {
  const file = join(root, 'app/pages/app/projects/[id]/episodes/[n].vue')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /导出剪映草稿/)
  assert.match(src, /生成旁白/)
  assert.match(src, /artifactStatus|artifactLabel/)
})
