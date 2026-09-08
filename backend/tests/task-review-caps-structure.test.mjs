import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('schema has task/review caps fields', () => {
  const schema = readFileSync(join(root, 'src/db/schema.ts'), 'utf8')
  assert.match(schema, /idempotencyKey|idempotency_key/)
  assert.match(schema, /configSnapshot|config_snapshot/)
  assert.match(schema, /taskEvents|task_events/)
  assert.match(schema, /reviewStatus|review_status/)
  assert.match(schema, /locked/)
  assert.match(schema, /progress/)
})

test('migration 0002_task_review_caps exists', () => {
  const mig = join(root, 'drizzle/0002_task_review_caps.sql')
  assert.ok(existsSync(mig))
  const src = readFileSync(mig, 'utf8')
  assert.match(src, /task_events/)
  assert.match(src, /review_status/)
  assert.match(src, /idempotency_key/)
  assert.match(src, /locked/)
  const journal = readFileSync(join(root, 'drizzle/meta/_journal.json'), 'utf8')
  assert.match(journal, /0002_task_review_caps/)
})

test('readyz in index and ready util', () => {
  const indexSrc = readFileSync(join(root, 'src/index.ts'), 'utf8')
  assert.match(indexSrc, /\/api\/v1\/readyz/)
  assert.match(indexSrc, /checkReady/)
  assert.ok(existsSync(join(root, 'src/utils/ready.ts')))
})

test('generate-script route and agent', () => {
  const agentRoute = readFileSync(join(root, 'src/routes/agent.ts'), 'utf8')
  assert.match(agentRoute, /generate-script/)
  assert.match(agentRoute, /generateScriptFromBrief/)
  const agents = readFileSync(join(root, 'src/agents/index.ts'), 'utf8')
  assert.match(agents, /generateScriptFromBrief/)
  const tools = readFileSync(join(root, 'src/agents/tools.ts'), 'utf8')
  assert.match(tools, /generateScriptTool/)
})

test('task events service and locked/review guards', () => {
  assert.ok(existsSync(join(root, 'src/services/task-events.ts')))
  const events = readFileSync(join(root, 'src/services/task-events.ts'), 'utf8')
  assert.match(events, /appendTaskEvent/)
  assert.match(events, /listTaskEvents/)
  assert.match(events, /setTaskProgress/)
  assert.match(events, /isTaskCancelled/)
  const gen = readFileSync(join(root, 'src/services/generation.ts'), 'utf8')
  assert.match(gen, /buildConfigSnapshot/)
  assert.match(gen, /findActiveByIdempotency/)
  assert.match(gen, /idempotencyKey/)
  const tasks = readFileSync(join(root, 'src/routes/tasks.ts'), 'utf8')
  assert.match(tasks, /请先确认该资产后再生成/)
  assert.match(tasks, /listTaskEvents/)
  const storyboards = readFileSync(join(root, 'src/routes/storyboards.ts'), 'utf8')
  assert.match(storyboards, /locked/)
  const chars = readFileSync(join(root, 'src/routes/characters.ts'), 'utf8')
  assert.match(chars, /\/confirm/)
  assert.match(chars, /reviewStatus/)
})
