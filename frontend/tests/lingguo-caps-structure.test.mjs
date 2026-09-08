import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('TaskDrawer shows progress', () => {
  const file = join(root, 'app/components/layout/TaskDrawer.vue')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /progress/)
  assert.match(src, /progress-bar|progress-fill/)
})

test('useAgent has generateScript', () => {
  const file = join(root, 'app/composables/useAgent.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /generateScript/)
  assert.match(src, /generate-script/)
})

test('useTasksStore TaskItem has progress/events', () => {
  const src = readFileSync(join(root, 'app/composables/useTasksStore.ts'), 'utf8')
  assert.match(src, /progress/)
  assert.match(src, /events/)
})

test('asset pages have review confirm', () => {
  for (const name of ['characters', 'scenes', 'props']) {
    const src = readFileSync(join(root, `app/pages/app/projects/[id]/${name}.vue`), 'utf8')
    assert.match(src, /全部确认/)
    assert.match(src, /reviewStatus/)
    assert.match(src, /\/confirm/)
  }
})

test('workbench has lock and generate from brief', () => {
  const src = readFileSync(join(root, 'app/pages/app/projects/[id]/episodes/[n].vue'), 'utf8')
  assert.match(src, /从大纲生成/)
  assert.match(src, /toggleLock|locked/)
  assert.match(src, /doGenerateFromBrief/)
})
