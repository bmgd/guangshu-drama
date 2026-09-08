import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('agents/tools.ts has createDramaTools', () => {
  const file = join(root, 'src/agents/tools.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /createDramaTools/)
  assert.match(src, /rewriteScriptTool/)
  assert.match(src, /extractElementsTool/)
  assert.match(src, /breakStoryboardTool/)
})

test('agents/index has runAgentChat', () => {
  const file = join(root, 'src/agents/index.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /runAgentChat/)
})
