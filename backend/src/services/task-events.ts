import { desc, eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { sysTasks, taskEvents } from '../db/schema.js'

export async function appendTaskEvent(
  taskId: number,
  event: string,
  message?: string,
  progress?: number,
) {
  const [row] = await db.insert(taskEvents).values({
    taskId,
    event,
    message: message ?? null,
    progress: progress ?? null,
    createdAt: nowIso(),
  }).returning()
  return row
}

export async function listTaskEvents(taskId: number, limit = 20) {
  return db.select().from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.id))
    .limit(limit)
}

export async function setTaskProgress(taskId: number, progress: number, message?: string) {
  await db.update(sysTasks).set({
    progress,
    updatedAt: nowIso(),
  }).where(eq(sysTasks.id, taskId))
  await appendTaskEvent(taskId, 'progress', message, progress)
}

export async function isTaskCancelled(taskId: number): Promise<boolean> {
  const rows = await db.select({ status: sysTasks.status }).from(sysTasks).where(eq(sysTasks.id, taskId)).limit(1)
  return rows[0]?.status === 'cancelled'
}
