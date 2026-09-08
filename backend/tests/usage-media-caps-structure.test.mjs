import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('usage route and usage_records table exist', () => {
  const route = join(root, 'src/routes/usage.ts')
  const schema = join(root, 'src/db/schema.ts')
  const service = join(root, 'src/services/usage.ts')
  assert.ok(existsSync(route), 'usage.ts route missing')
  assert.ok(existsSync(service), 'usage service missing')
  const schemaSrc = readFileSync(schema, 'utf8')
  assert.match(schemaSrc, /usageRecords|usage_records/)
  const indexSrc = readFileSync(join(root, 'src/index.ts'), 'utf8')
  assert.match(indexSrc, /\/api\/v1\/usage/)
})

test('jianying-export service exists', () => {
  const file = join(root, 'src/services/jianying-export.ts')
  assert.ok(existsSync(file), 'jianying-export.ts missing')
  const src = readFileSync(file, 'utf8')
  assert.ok(/draft_info\.json|draft_content\.json/.test(src), 'expected draft json filenames')
  assert.ok(/segment_/.test(src), 'expected segment asset naming')
  assert.ok(/简化草稿/.test(src), 'expected simplified draft comment')
})

test('openai-tts / audio adapter exists', () => {
  const tts = join(root, 'src/services/adapters/openai-tts.ts')
  const types = join(root, 'src/services/adapters/types.ts')
  const registry = join(root, 'src/services/adapters/registry.ts')
  assert.ok(existsSync(tts), 'openai-tts.ts missing')
  const typesSrc = readFileSync(types, 'utf8')
  assert.match(typesSrc, /AudioAdapter/)
  const regSrc = readFileSync(registry, 'utf8')
  assert.match(regSrc, /getAudioAdapter/)
  const ttsSrc = readFileSync(tts, 'utf8')
  assert.match(ttsSrc, /audio\/speech/)
})

test('media_versions in schema', () => {
  const schema = readFileSync(join(root, 'src/db/schema.ts'), 'utf8')
  assert.match(schema, /mediaVersions|media_versions/)
  assert.ok(existsSync(join(root, 'src/services/media-versions.ts')))
  assert.ok(existsSync(join(root, 'src/routes/versions.ts')))
})

test('creationType in dramas schema', () => {
  const schema = readFileSync(join(root, 'src/db/schema.ts'), 'utf8')
  assert.match(schema, /creationType|creation_type/)
  assert.match(schema, /contentSource|content_source/)
  assert.match(schema, /generationMode|generation_mode/)
})
