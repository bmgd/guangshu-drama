import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('ConfirmDialog.vue exists; settings or characters uses ConfirmDialog', () => {
  const dialog = join(root, 'app/components/ConfirmDialog.vue')
  assert.ok(existsSync(dialog), 'ConfirmDialog.vue missing')

  const settings = readFileSync(join(root, 'app/pages/app/settings.vue'), 'utf8')
  const characters = readFileSync(
    join(root, 'app/pages/app/projects/[id]/characters.vue'),
    'utf8',
  )
  assert.ok(
    /ConfirmDialog/.test(settings) || /ConfirmDialog/.test(characters),
    'expected ConfirmDialog usage in settings or characters',
  )
})
