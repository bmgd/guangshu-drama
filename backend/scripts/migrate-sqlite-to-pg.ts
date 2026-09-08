/**
 * One-shot migrator: SQLite (better-sqlite3 file) -> PostgreSQL.
 * Usage: DATABASE_URL=... SQLITE_PATH=../data/guangshu.db npx tsx scripts/migrate-sqlite-to-pg.ts
 *
 * Requires optional peer better-sqlite3 only for this script (install temporarily if needed).
 */
import postgres from 'postgres'
import { readFileSync, existsSync } from 'node:fs'

const sqlitePath = process.env.SQLITE_PATH || './data/guangshu.db'
const databaseUrl = process.env.DATABASE_URL || 'postgres://guangshu:guangshu@127.0.0.1:5432/guangshu_drama'

const TABLES = [
  'dramas', 'episodes', 'characters', 'scenes', 'props', 'storyboards',
  'episode_characters', 'episode_scenes', 'episode_props',
  'storyboard_characters', 'storyboard_props',
  'ai_service_configs', 'ai_service_providers', 'style_presets',
  'sys_task', 'video_merges', 'assets',
]

async function main() {
  if (!existsSync(sqlitePath)) {
    console.error(`SQLite 文件不存在: ${sqlitePath}`)
    process.exit(1)
  }

  // Dynamic import so normal runtime doesn't need better-sqlite3
  const Database = (await import('better-sqlite3')).default
  const sqlite = new Database(sqlitePath, { readonly: true })
  const pg = postgres(databaseUrl, { max: 1 })

  console.log(`迁移 ${sqlitePath} -> ${databaseUrl}`)

  for (const table of TABLES) {
    try {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
      if (!rows.length) {
        console.log(`  ${table}: 空表，跳过`)
        continue
      }
      // Clear target then insert
      await pg.unsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
      const columns = Object.keys(rows[0])
      for (const row of rows) {
        const values = columns.map((c) => {
          const v = row[c]
          // SQLite stores booleans as 0/1
          if (v === 0 || v === 1) {
            if (['is_default', 'is_active', 'is_favorite'].includes(c)) return Boolean(v)
          }
          return v
        })
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
        await pg.unsafe(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values as (string | number | boolean | null)[],
        )
      }
      // Reset serial sequences
      await pg.unsafe(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`)
      console.log(`  ${table}: ${rows.length} 行`)
    } catch (err) {
      console.warn(`  ${table}: 跳过 (${err instanceof Error ? err.message : err})`)
    }
  }

  await pg.end()
  sqlite.close()
  console.log('迁移完成')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
