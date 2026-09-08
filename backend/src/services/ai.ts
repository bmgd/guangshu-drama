import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiServiceConfigs } from '../db/schema.js'

export type ServiceType = 'text' | 'image' | 'video' | 'tts'

export async function getActiveConfig(serviceType: ServiceType) {
  const rows = await db.select().from(aiServiceConfigs)
    .where(and(eq(aiServiceConfigs.serviceType, serviceType), eq(aiServiceConfigs.isActive, true)))
  return rows.find((r) => r.isDefault) || rows.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null
}

export async function getConfigById(id: number) {
  if (!id || !Number.isFinite(id)) return null
  const rows = await db.select().from(aiServiceConfigs).where(eq(aiServiceConfigs.id, id)).limit(1)
  return rows[0] || null
}

export function maskApiKey(key: string) {
  if (!key || key.length < 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}
