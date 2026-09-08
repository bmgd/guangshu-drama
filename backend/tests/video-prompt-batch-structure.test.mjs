import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('tasks.ts has video/batch and retry', () => {
  const file = join(root, 'src/routes/tasks.ts')
  assert.ok(existsSync(file))
  const src = readFileSync(file, 'utf8')
  assert.match(src, /video\/batch/)
  assert.match(src, /retry/)
})
