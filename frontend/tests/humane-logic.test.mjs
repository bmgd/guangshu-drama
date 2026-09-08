import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function nextCoachStage({ hasScript, hasBoards, imageCount, videoCount, boardCount, hasMerged }) {
  if (!hasScript) return 'script'
  if (!hasBoards) return 'boards'
  if (imageCount < 4 && videoCount === 0) return 'sample'
  if (videoCount < boardCount) return 'videos'
  if (!hasMerged) return 'export'
  return 'done'
}

function estimateVideoCost(items, rate = 0.1) {
  const units = items.reduce((sum, item) => sum + (item.duration || 5), 0)
  return Math.round(units * rate * 100) / 100
}

function shouldWarnSample(count, isSample, sampleDone) {
  return !isSample && count > 4 && !sampleDone
}

function pickSampleMissing(boards, n = 3) {
  return boards.filter((b) => !b.videoUrl).slice(0, n)
}

test('coach stage machine matches workbench rules', () => {
  assert.equal(nextCoachStage({ hasScript: false, hasBoards: false, imageCount: 0, videoCount: 0, boardCount: 0, hasMerged: false }), 'script')
  assert.equal(nextCoachStage({ hasScript: true, hasBoards: false, imageCount: 0, videoCount: 0, boardCount: 0, hasMerged: false }), 'boards')
  assert.equal(nextCoachStage({ hasScript: true, hasBoards: true, imageCount: 1, videoCount: 0, boardCount: 8, hasMerged: false }), 'sample')
  assert.equal(nextCoachStage({ hasScript: true, hasBoards: true, imageCount: 8, videoCount: 2, boardCount: 8, hasMerged: false }), 'videos')
  assert.equal(nextCoachStage({ hasScript: true, hasBoards: true, imageCount: 8, videoCount: 8, boardCount: 8, hasMerged: false }), 'export')
  assert.equal(nextCoachStage({ hasScript: true, hasBoards: true, imageCount: 8, videoCount: 8, boardCount: 8, hasMerged: true }), 'done')
})

test('sample picker takes first 3 missing videos', () => {
  const boards = [
    { id: 1, videoUrl: null },
    { id: 2, videoUrl: 'x' },
    { id: 3, videoUrl: null },
    { id: 4, videoUrl: null },
    { id: 5, videoUrl: null },
  ]
  assert.deepEqual(pickSampleMissing(boards).map((b) => b.id), [1, 3, 4])
})

test('batch sample warning gate', () => {
  assert.equal(shouldWarnSample(8, false, false), true)
  assert.equal(shouldWarnSample(3, false, false), false)
  assert.equal(shouldWarnSample(8, true, false), false)
  assert.equal(shouldWarnSample(8, false, true), false)
})

test('video cost estimate is stable', () => {
  assert.equal(estimateVideoCost([{ duration: 5 }, { duration: 5 }, { duration: 10 }]), 2)
  assert.equal(estimateVideoCost([{ duration: 5 }], 0.2), 1)
})

test('onboarding UX strings exist in key pages', () => {
  const episode = readFileSync(join(root, 'app/pages/app/projects/[id]/episodes/[n].vue'), 'utf8')
  assert.match(episode, /过期 = 镜头已有视频/)
  assert.match(episode, /prepareVideoConfirm/)
  assert.match(episode, /guangshu-sample-done-/)

  const overview = readFileSync(join(root, 'app/pages/app/projects/[id]/index.vue'), 'utf8')
  assert.match(overview, /制作清单/)

  const settings = readFileSync(join(root, 'app/pages/app/settings.vue'), 'utf8')
  assert.match(settings, /首次|向导|步骤/)

  const create = readFileSync(join(root, 'app/pages/app/projects/index.vue'), 'utf8')
  assert.match(create, /field-hint|先用一章|旁白主导/)

  assert.ok(existsSync(join(root, 'app/components/BatchVideoConfirm.vue')))
  const batch = readFileSync(join(root, 'app/components/BatchVideoConfirm.vue'), 'utf8')
  assert.match(batch, /estimatedCost|预估费用/)
})
