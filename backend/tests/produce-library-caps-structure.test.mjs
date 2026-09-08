import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('schema has produce_checkpoints', () => {
  const schema = readFileSync(join(root, 'src/db/schema.ts'), 'utf8')
  assert.match(schema, /produceCheckpoints|produce_checkpoints/)
  assert.match(schema, /episodeId/)
})

test('migration 0003_produce_library_caps exists', () => {
  const mig = join(root, 'drizzle/0003_produce_library_caps.sql')
  assert.ok(existsSync(mig))
  const src = readFileSync(mig, 'utf8')
  assert.match(src, /produce_checkpoints/)
  const journal = readFileSync(join(root, 'drizzle/meta/_journal.json'), 'utf8')
  assert.match(journal, /0003_produce_library_caps/)
})

test('produce-pipeline service exists', () => {
  const file = join(root, 'src/services/produce-pipeline.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /runProducePipeline/)
  assert.match(src, /saveProduceCheckpoint/)
  assert.match(src, /await_confirm/)
  assert.match(src, /sample_images/)
  assert.match(src, /sample_last_frames/)
  assert.match(src, /sample_videos/)
})

test('agent produce SSE and checkpoint', () => {
  const src = readFileSync(join(root, 'src/routes/agent.ts'), 'utf8')
  assert.match(src, /\/produce/)
  assert.match(src, /produce-checkpoint/)
  assert.match(src, /runProducePipeline/)
  assert.match(src, /\/pipeline/)
})

test('frameType in generation and tasks', () => {
  const gen = readFileSync(join(root, 'src/services/generation.ts'), 'utf8')
  assert.match(gen, /frameType/)
  assert.match(gen, /lastFrameImage/)
  assert.match(gen, /referenceImages/)
  assert.match(gen, /storyboardCharacters/)
  const tasks = readFileSync(join(root, 'src/routes/tasks.ts'), 'utf8')
  assert.match(tasks, /frameType/)
})

test('storyboard character linking helper', () => {
  const file = join(root, 'src/services/storyboard-links.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /linkStoryboardCharacters/)
})

test('volcengine image uses referenceImages', () => {
  const src = readFileSync(join(root, 'src/services/adapters/volcengine-image.ts'), 'utf8')
  assert.match(src, /referenceImages/)
})

test('assets stats and cross-project list', () => {
  const src = readFileSync(join(root, 'src/routes/assets.ts'), 'utf8')
  assert.match(src, /\/stats/)
  assert.match(src, /\bq\b/)
  assert.match(src, /storageBytes|fileSize/)
})

test('character cascade-regen', () => {
  const src = readFileSync(join(root, 'src/routes/characters.ts'), 'utf8')
  assert.match(src, /cascade-regen/)
  assert.match(src, /cascade-/)
  assert.match(src, /includeVideo/)
})
