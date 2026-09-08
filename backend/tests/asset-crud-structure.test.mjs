import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const routes = ['characters', 'scenes', 'props', 'assets']

test('asset CRUD routes exist and export Router', () => {
  for (const name of routes) {
    const file = join(root, 'src/routes', `${name}.ts`)
    assert.ok(existsSync(file), `missing route: ${name}.ts`)
    const src = readFileSync(file, 'utf8')
    assert.match(src, /export\s+const\s+\w*Router/, `${name}.ts should export Router`)
  }
})
