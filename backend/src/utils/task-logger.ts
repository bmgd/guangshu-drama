import pino from 'pino'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
})

function resolveTaskLogDir() {
  if (process.env.TASK_LOG_DIR) return process.env.TASK_LOG_DIR
  // Prefer sibling of STORAGE_PATH (…/data/logs), else ./data/logs
  const storage = process.env.STORAGE_PATH || './data/static'
  return join(storage, '..', 'logs')
}

export function logTask(taskId: number | string, message: string, extra?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const extraPart = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''
  const line = `[${ts}] task=${taskId} ${message}${extraPart}`
  console.log(line)
  logger.info({ taskId, ...extra }, message)

  try {
    const dir = resolveTaskLogDir()
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, `task-${taskId}.log`), `${line}\n`, 'utf8')
  } catch {
    // file logging is best-effort
  }
}
