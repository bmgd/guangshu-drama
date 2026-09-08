import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('workbench has produce sample and resume', () => {
  const src = readFileSync(join(root, 'app/pages/app/projects/[id]/episodes/[n].vue'), 'utf8')
  assert.match(src, /一键生产（样片）/)
  assert.match(src, /从检查点继续/)
  assert.match(src, /runProduceSample|\/agent\/produce/)
  assert.match(src, /resumeProduce|produce-checkpoint/)
  assert.match(src, /生成尾帧|regenLastFrame/)
  assert.match(src, /样片尾帧/)
})

test('projects create has first_last_frame mode', () => {
  const src = readFileSync(join(root, 'app/pages/app/projects/index.vue'), 'utf8')
  assert.match(src, /first_last_frame/)
  assert.match(src, /同时生成首帧与尾帧/)
})

test('library page exists', () => {
  const file = join(root, 'app/pages/app/library/index.vue')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /\/assets/)
  assert.match(src, /\/assets\/stats/)
  assert.match(src, /素材库/)
})

test('GlobalHeader links to library', () => {
  const src = readFileSync(join(root, 'app/components/layout/GlobalHeader.vue'), 'utf8')
  assert.match(src, /\/app\/library/)
})

test('characters page has cascade regen', () => {
  const src = readFileSync(join(root, 'app/pages/app/projects/[id]/characters.vue'), 'utf8')
  assert.match(src, /重生并更新关联分镜/)
  assert.match(src, /cascade-regen/)
})

test('CoachCard can trigger produce', () => {
  const src = readFileSync(join(root, 'app/pages/app/projects/[id]/episodes/[n].vue'), 'utf8')
  assert.match(src, /produceSample/)
})
