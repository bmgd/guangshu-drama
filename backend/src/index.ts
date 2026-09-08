import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'
import { initDatabase } from './db/index.js'
import { ensureStorage } from './utils/storage.js'
import { dramasRouter } from './routes/dramas.js'
import { episodesRouter } from './routes/episodes.js'
import { charactersRouter } from './routes/characters.js'
import { scenesRouter } from './routes/scenes.js'
import { propsRouter } from './routes/props.js'
import { storyboardsRouter } from './routes/storyboards.js'
import { tasksRouter } from './routes/tasks.js'
import { mergeRouter } from './routes/merge.js'
import { promptsRouter } from './routes/prompts.js'
import { agentRouter } from './routes/agent.js'
import { aiConfigsRouter } from './routes/aiConfigs.js'
import { skillsRouter } from './routes/skills.js'
import { stylePresetsRouter } from './routes/stylePresets.js'
import { uploadRouter } from './routes/upload.js'
import { assetsRouter } from './routes/assets.js'
import { providersRouter } from './routes/providers.js'
import { usageRouter } from './routes/usage.js'
import { versionsRouter } from './routes/versions.js'
import { jsonOk, ok } from './utils/response.js'
import { startTaskPoller } from './services/generation.js'
import { checkReady } from './utils/ready.js'

dotenv.config()

const app = new Hono()
const port = Number(process.env.PORT || 5679)
const storagePath = process.env.STORAGE_PATH || './data/static'

app.use('*', cors())
app.use('*', honoLogger())

app.get('/api/v1/health', (c) => jsonOk(c, { status: 'ok', service: 'guangshu-drama' }))

app.get('/api/v1/readyz', async (c) => {
  const result = await checkReady()
  return c.json(ok(result), result.ok ? 200 : 503)
})

app.route('/api/v1/dramas', dramasRouter)
app.route('/api/v1/episodes', episodesRouter)
app.route('/api/v1/characters', charactersRouter)
app.route('/api/v1/scenes', scenesRouter)
app.route('/api/v1/props', propsRouter)
app.route('/api/v1/storyboards', storyboardsRouter)
app.route('/api/v1/tasks', tasksRouter)
app.route('/api/v1/merge', mergeRouter)
app.route('/api/v1/prompts', promptsRouter)
app.route('/api/v1/agent', agentRouter)
app.route('/api/v1/ai-configs', aiConfigsRouter)
app.route('/api/v1/skills', skillsRouter)
app.route('/api/v1/style-presets', stylePresetsRouter)
app.route('/api/v1/upload', uploadRouter)
app.route('/api/v1/assets', assetsRouter)
app.route('/api/v1/providers', providersRouter)
app.route('/api/v1/usage', usageRouter)
app.route('/api/v1/versions', versionsRouter)

app.use('/static/*', serveStatic({ root: storagePath }))

const frontendDist = join(process.cwd(), '../frontend/dist')
const frontendOutput = join(process.cwd(), '../frontend/.output/public')
const staticRoot = existsSync(frontendDist) ? frontendDist : frontendOutput
if (existsSync(staticRoot)) {
  app.use('/*', serveStatic({ root: staticRoot }))
  app.get('*', serveStatic({ path: join(staticRoot, 'index.html') }))
}

async function bootstrap() {
  await initDatabase()
  ensureStorage()
  startTaskPoller()
  serve({ fetch: app.fetch, port }, () => {
    console.log(`光束短剧 API 运行于 http://localhost:${port}`)
    console.log(`静态资源目录: ${storagePath}`)
  })
}

bootstrap().catch((err) => {
  console.error('启动失败:', err)
  process.exit(1)
})
