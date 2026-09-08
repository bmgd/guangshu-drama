import dotenv from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

dotenv.config()

const databaseUrl = process.env.DATABASE_URL
  || 'postgres://guangshu:guangshu@127.0.0.1:5432/guangshu_drama'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, '../../drizzle')

async function main() {
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)
  console.log('Running migrations from', migrationsFolder)
  await migrate(db, { migrationsFolder })
  await client.end()
  console.log('Migrations complete')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
