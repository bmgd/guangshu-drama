import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('PhaseStepper.vue has completedPhases', () => {
  const file = join(root, 'app/components/layout/PhaseStepper.vue')
  assert.ok(existsSync(file), 'PhaseStepper.vue missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /completedPhases/)
})
