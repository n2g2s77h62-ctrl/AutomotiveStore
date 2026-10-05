import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.STORE_DB_PATH ?? resolve(directory, '../data/store.db')

mkdirSync(dirname(databasePath), { recursive: true })

export const database = new Database(databasePath)
database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')
database.exec(readFileSync(resolve(directory, 'schema.sql'), 'utf8'))