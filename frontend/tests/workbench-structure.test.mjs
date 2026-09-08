import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('episodes/[n].vue has BatchVideoConfirm and patchStoryboard/duration', () => {
  const file = join(root, 'app/pages/app/projects/[id]/episodes/[n].vue')
  assert.ok(existsSync(file), 'episode workbench page missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /BatchVideoConfirm/)
  assert.ok(
    /patchStoryboard/.test(src) || /duration/.test(src),
    'expected patchStoryboard usage or duration',
  )
})

test('CoachCard exists and workbench has sample-first UX', () => {
  const coach = join(root, 'app/components/CoachCard.vue')
  assert.ok(existsSync(coach), 'CoachCard.vue missing')
  const coachSrc = readFileSync(coach, 'utf8')
  assert.match(coachSrc, /guangshu-coach-/)
  assert.match(coachSrc, /defineEmits/)

  const episode = join(root, 'app/pages/app/projects/[id]/episodes/[n].vue')
  const src = readFileSync(episode, 'utf8')
  assert.match(src, /样片/)
  assert.match(src, /openBatchVideoSample/)
  assert.match(src, /CoachCard/)
})
