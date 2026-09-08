import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('GlobalHeader or episode page mentions resolution', () => {
  const header = join(root, 'app/components/layout/GlobalHeader.vue')
  const episode = join(root, 'app/pages/app/projects/[id]/episodes/[n].vue')
  assert.ok(existsSync(header) || existsSync(episode))
  const sources = []
  if (existsSync(header)) sources.push(readFileSync(header, 'utf8'))
  if (existsSync(episode)) sources.push(readFileSync(episode, 'utf8'))
  const combined = sources.join('\n')
  assert.match(combined, /resolution/i)
})
