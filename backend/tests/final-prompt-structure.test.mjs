import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('final-prompt.ts has applyCharacterPrompt helpers', () => {
  const file = join(root, 'src/services/final-prompt.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /applyCharacterPrompt/)
  assert.match(src, /applyScenePrompt/)
  assert.match(src, /applyPropPrompt/)
  assert.match(src, /applyStoryboardPrompts/)
})
