import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { client } from '../db/index.js'

const execFileAsync = promisify(execFile)

export type ReadyChecks = {
  database: boolean
  storage: boolean
  ffmpeg: boolean
}

export type ReadyResult = {
  ok: boolean
  checks: ReadyChecks
}

async function checkDatabase(): Promise<boolean> {
  try {
    await client`SELECT 1`
    return true
  } catch {
    return false
  }
}

async function checkStorage(): Promise<boolean> {
  try {
    const root = process.env.STORAGE_PATH || './data/static'
    mkdirSync(root, { recursive: true })
    const tmp = join(root, `.readyz-${Date.now()}.tmp`)
    writeFileSync(tmp, 'ok')
    unlinkSync(tmp)
    return true
  } catch {
    return false
  }
}

async function checkFfmpeg(): Promise<boolean> {
  const candidates: string[] = []
  if (typeof ffmpegStatic === 'string' && ffmpegStatic) candidates.push(ffmpegStatic)
  if (ffprobeStatic?.path) candidates.push(ffprobeStatic.path)
  for (const bin of candidates) {
    if (existsSync(bin)) {
      try {
        await execFileAsync(bin, ['-version'], { timeout: 5000 })
        return true
      } catch {
        /* try next */
      }
    }
  }
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function checkReady(): Promise<ReadyResult> {
  const [database, storage, ffmpeg] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkFfmpeg(),
  ])
  const checks = { database, storage, ffmpeg }
  return { ok: database && storage && ffmpeg, checks }
}
