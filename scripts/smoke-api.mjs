#!/usr/bin/env node
/**
 * 无 Docker 时的 API 冒烟：嵌入式 Postgres → 启动后端 → 打关键接口 → 收尾。
 * 用法：PATH 含 node 后执行  node scripts/smoke-api.mjs
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'backend/package.json'))
const EmbeddedPostgres = require('embedded-postgres').default || require('embedded-postgres')
const pgDir = join(root, 'data', 'pg-smoke')
const PG_PORT = 55432
const API_PORT = 15679
const DATABASE_URL = `postgres://guangshu:guangshu@127.0.0.1:${PG_PORT}/guangshu_drama`
const BASE = `http://127.0.0.1:${API_PORT}/api/v1`

const results = []

function log(ok, name, detail = '') {
  results.push({ ok, name, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitHealth(timeoutMs = 45000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const { status, body } = await api('/health')
      if (status === 200 && body?.code === 0) return body
    } catch {
      /* retry */
    }
    await sleep(500)
  }
  throw new Error('后端 health 超时')
}

async function main() {
  if (existsSync(pgDir)) rmSync(pgDir, { recursive: true, force: true })
  mkdirSync(pgDir, { recursive: true })
  mkdirSync(join(root, 'data', 'static'), { recursive: true })

  const pg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: 'guangshu',
    password: 'guangshu',
    port: PG_PORT,
    persistent: false,
  })

  let backend
  try {
    console.log('启动嵌入式 PostgreSQL...')
    await pg.initialise()
    await pg.start()
    await pg.createDatabase('guangshu_drama')
    log(true, 'embedded postgres', `port ${PG_PORT}`)

    console.log('启动后端...')
    backend = spawn(
      join(root, '.tools/node-v22.14.0-darwin-arm64/bin/npx'),
      ['tsx', 'src/index.ts'],
      {
        cwd: join(root, 'backend'),
        env: {
          ...process.env,
          DATABASE_URL,
          PORT: String(API_PORT),
          STORAGE_PATH: join(root, 'data', 'static'),
          NODE_ENV: 'development',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let backendLog = ''
    backend.stdout.on('data', (d) => { backendLog += d.toString() })
    backend.stderr.on('data', (d) => { backendLog += d.toString() })

    await waitHealth()
    log(true, 'GET /health')

    const readyz = await api('/readyz')
    log(
      readyz.status === 200 && readyz.body?.code === 0 && readyz.body?.data?.ok === true,
      'GET /readyz',
      JSON.stringify(readyz.body?.data?.checks),
    )

    const status = await api('/ai-configs/status')
    log(status.status === 200 && status.body?.code === 0, 'GET /ai-configs/status',
      JSON.stringify(status.body?.data))

    const drama = await api('/dramas', {
      method: 'POST',
      body: JSON.stringify({
        title: `冒烟测试 ${Date.now()}`,
        contentSource: 'novel',
        creationType: 'drama',
        generationMode: 'storyboard',
        totalEpisodes: 1,
      }),
    })
    const dramaId = drama.body?.data?.id
    log(drama.status === 201 && dramaId, 'POST /dramas', `id=${dramaId}`)

    const episode = await api('/episodes', {
      method: 'POST',
      body: JSON.stringify({
        dramaId,
        episodeNumber: 1,
        title: '第1集',
        content: '旁白：清晨的小镇。\n角色甲：今天开始试跑样片。',
      }),
    })
    const episodeId = episode.body?.data?.id
    log(episode.status === 201 && episodeId, 'POST /episodes', `id=${episodeId}`)

    const boards = await api('/storyboards/batch', {
      method: 'POST',
      body: JSON.stringify({
        episodeId,
        items: [
          { storyboardNumber: 1, title: '开场', description: '小镇清晨', imagePrompt: 'morning town', videoPrompt: 'pan', duration: 5 },
          { storyboardNumber: 2, title: '对白', description: '角色说话', imagePrompt: 'character talking', videoPrompt: 'medium shot', duration: 5 },
          { storyboardNumber: 3, title: '转场', description: '街道', imagePrompt: 'street', videoPrompt: 'dolly', duration: 5 },
          { storyboardNumber: 4, title: '收尾', description: '远景', imagePrompt: 'wide', videoPrompt: 'crane', duration: 5 },
          { storyboardNumber: 5, title: '余韵', description: '落日', imagePrompt: 'sunset', videoPrompt: 'static', duration: 5 },
        ],
      }),
    })
    const boardList = boards.body?.data || []
    log(boards.status === 201 && boardList.length === 5, 'POST /storyboards/batch', `count=${boardList.length}`)

    const character = await api('/characters', {
      method: 'POST',
      body: JSON.stringify({
        dramaId,
        name: '冒烟角色',
        description: '测试用',
      }),
    })
    const characterId = character.body?.data?.id
    log(
      character.status === 201 && character.body?.data?.reviewStatus === 'pending_review',
      'POST /characters reviewStatus',
      character.body?.data?.reviewStatus,
    )

    const confirmed = await api('/characters/confirm', {
      method: 'POST',
      body: JSON.stringify({ ids: [characterId] }),
    })
    log(
      confirmed.status === 200 && confirmed.body?.data?.[0]?.reviewStatus === 'confirmed',
      'POST /characters/confirm',
    )

    const firstBoardId = boardList[0]?.id
    const locked = await api(`/storyboards/${firstBoardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ locked: true }),
    })
    log(locked.status === 200 && locked.body?.data?.locked === true, 'PATCH storyboard locked')

    const listed = await api(`/storyboards?episodeId=${episodeId}`)
    const artifacts = (listed.body?.data || []).map((b) => b.artifactStatus)
    log(
      listed.status === 200 && artifacts.every((s) => s === 'missing'),
      'GET /storyboards artifactStatus',
      artifacts.join(','),
    )

    const sample = (listed.body?.data || []).filter((b) => !b.videoUrl).slice(0, 3)
    log(sample.length === 3, '样片选取前3镜', sample.map((b) => b.storyboardNumber).join(','))

    const warnNeeded = boardList.length > 4
    log(warnNeeded, '大批量应触发样片警告门槛', `n=${boardList.length}`)

    const usage = await api('/usage/summary')
    log(usage.status === 200 && usage.body?.code === 0, 'GET /usage/summary')

    const assetStats = await api('/assets/stats')
    log(
      assetStats.status === 200 && assetStats.body?.code === 0 && typeof assetStats.body?.data?.total === 'number',
      'GET /assets/stats',
      JSON.stringify(assetStats.body?.data),
    )

    const checkpoint = await api(`/agent/produce-checkpoint?episodeId=${episodeId}`)
    log(
      checkpoint.status === 200 && checkpoint.body?.code === 0,
      'GET /agent/produce-checkpoint',
      checkpoint.body?.data ? `step=${checkpoint.body.data.step}` : 'null',
    )

    log(
      existsSync(join(root, 'backend/src/services/produce-pipeline.ts')),
      'structure produce-pipeline.ts',
    )
    log(
      existsSync(join(root, 'backend/drizzle/0003_produce_library_caps.sql')),
      'structure 0003_produce_library_caps.sql',
    )
    log(
      existsSync(join(root, 'frontend/app/pages/app/library/index.vue')),
      'structure library page',
    )

    const dramas = await api('/dramas')
    log(
      dramas.status === 200 && (dramas.body?.data || []).some((d) => d.id === dramaId),
      'GET /dramas 含新建项目',
    )

    // soft delete cleanup
    await api(`/dramas/${dramaId}`, { method: 'DELETE' })
    log(true, '冒烟数据清理')
  } catch (err) {
    log(false, '冒烟中断', err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  } finally {
    if (backend && !backend.killed) {
      backend.kill('SIGTERM')
      await sleep(800)
      if (!backend.killed) backend.kill('SIGKILL')
    }
    try {
      await pg.stop()
    } catch { /* ignore */ }
    try {
      rmSync(pgDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }

  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log(`合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`)
  if (failed.length) {
    process.exitCode = 1
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`)
  }
}

main()
