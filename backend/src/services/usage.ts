import { eq } from 'drizzle-orm'
import { db, nowIso } from '../db/index.js'
import { usageRecords, aiServiceConfigs } from '../db/schema.js'
import type { ServiceType } from './ai.js'

export type UnitType = 'token' | 'image' | 'second' | 'char'

export type RecordUsageInput = {
  dramaId?: number | null
  episodeId?: number | null
  taskId?: number | null
  serviceType: ServiceType | string
  provider?: string | null
  model?: string | null
  unitType: UnitType | string
  units: number
  estimatedCost?: number | string | null
  actualCost?: number | string | null
  currency?: string
  meta?: Record<string, unknown> | string | null
  /** 若提供 configId，从 settings JSON 读取 pricePerUnit / unitType */
  configId?: number | null
}

function parseSettings(raw?: string | null): { pricePerUnit?: number; unitType?: string } {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as { pricePerUnit?: number; unitType?: string }
    return {
      pricePerUnit: typeof parsed.pricePerUnit === 'number' ? parsed.pricePerUnit : undefined,
      unitType: typeof parsed.unitType === 'string' ? parsed.unitType : undefined,
    }
  } catch {
    return {}
  }
}

export async function recordUsage(input: RecordUsageInput) {
  let unitType = input.unitType
  let estimatedCost = input.estimatedCost
  let provider = input.provider
  let model = input.model

  if (input.configId) {
    const rows = await db.select().from(aiServiceConfigs).where(eq(aiServiceConfigs.id, input.configId)).limit(1)
    const cfg = rows[0]
    if (cfg) {
      provider = provider || cfg.provider
      model = model || cfg.model
      const settings = parseSettings(cfg.settings)
      if (settings.unitType) unitType = settings.unitType
      if (estimatedCost == null && typeof settings.pricePerUnit === 'number') {
        estimatedCost = settings.pricePerUnit * input.units
      }
    }
  }

  const now = nowIso()
  const [row] = await db.insert(usageRecords).values({
    dramaId: input.dramaId ?? null,
    episodeId: input.episodeId ?? null,
    taskId: input.taskId ?? null,
    serviceType: input.serviceType,
    provider: provider ?? null,
    model: model ?? null,
    unitType,
    units: String(input.units),
    estimatedCost: estimatedCost != null ? String(estimatedCost) : null,
    actualCost: input.actualCost != null ? String(input.actualCost) : null,
    currency: input.currency || 'CNY',
    meta: typeof input.meta === 'string'
      ? input.meta
      : input.meta
        ? JSON.stringify(input.meta)
        : null,
    createdAt: now,
  }).returning()
  return row
}

export type UsageSumRow = {
  serviceType: string
  units: number
  estimatedCost: number
  actualCost: number
  count: number
}

function aggregate(rows: Array<typeof usageRecords.$inferSelect>): UsageSumRow[] {
  const map = new Map<string, UsageSumRow>()
  for (const r of rows) {
    const key = r.serviceType
    const cur = map.get(key) || { serviceType: key, units: 0, estimatedCost: 0, actualCost: 0, count: 0 }
    cur.units += Number(r.units) || 0
    cur.estimatedCost += Number(r.estimatedCost) || 0
    cur.actualCost += Number(r.actualCost) || 0
    cur.count += 1
    map.set(key, cur)
  }
  return [...map.values()]
}

export async function sumByDrama(dramaId: number) {
  const rows = await db.select().from(usageRecords).where(eq(usageRecords.dramaId, dramaId))
  const byService = aggregate(rows)
  const totalEstimated = byService.reduce((s, r) => s + r.estimatedCost, 0)
  const totalActual = byService.reduce((s, r) => s + r.actualCost, 0)
  const totalUnits = byService.reduce((s, r) => s + r.units, 0)
  return {
    dramaId,
    byService,
    totalEstimated,
    totalActual,
    totalUnits,
    currency: 'CNY',
    recordCount: rows.length,
  }
}

export async function sumGlobal() {
  const rows = await db.select().from(usageRecords)
  const byService = aggregate(rows)
  const totalEstimated = byService.reduce((s, r) => s + r.estimatedCost, 0)
  const totalActual = byService.reduce((s, r) => s + r.actualCost, 0)
  const totalUnits = byService.reduce((s, r) => s + r.units, 0)
  return {
    byService,
    totalEstimated,
    totalActual,
    totalUnits,
    currency: 'CNY',
    recordCount: rows.length,
  }
}
