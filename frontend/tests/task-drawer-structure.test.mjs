import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('TaskDrawer.vue exists', () => {
  const file = join(root, 'app/components/layout/TaskDrawer.vue')
  assert.ok(existsSync(file), 'TaskDrawer.vue missing')
})
