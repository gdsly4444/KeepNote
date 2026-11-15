import { DatabaseSync } from 'node:sqlite'
import type { DocumentType } from '../../shared'

export interface CachedNote {
  path: string
  name: string
  title: string
  type: DocumentType
  mtimeMs: number
}

export interface NoteCache {
  read(): CachedNote[]
  replace(notes: readonly CachedNote[]): void
  close(): void
}

const documentTypes = ['work', 'essay', 'journal', 'list', 'tech'] as const

export function openCache(file: string): NoteCache {
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE IF NOT EXISTS notes (
    path TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    mtime INTEGER NOT NULL
  )`)
  const insert = db.prepare('INSERT INTO notes (path, name, title, type, mtime) VALUES (?, ?, ?, ?, ?)')
  return {
    read() {
      const notes: CachedNote[] = []
      for (const row of db.prepare('SELECT path, name, title, type, mtime FROM notes').all()) {
        const note = cachedNote(row)
        if (note) notes.push(note)
      }
      return notes
    },
    replace(notes) {
      db.exec('BEGIN')
      try {
        db.exec('DELETE FROM notes')
        for (const note of notes) {
          insert.run(note.path, note.name, note.title, note.type, Math.trunc(note.mtimeMs))
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    close() {
      db.close()
    }
  }
}

function cachedNote(value: unknown): CachedNote | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.path !== 'string' || typeof row.name !== 'string' || typeof row.title !== 'string') return null
  if (typeof row.mtime !== 'number' || !isDocumentType(row.type)) return null
  return { path: row.path, name: row.name, title: row.title, type: row.type, mtimeMs: row.mtime }
}

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && documentTypes.some((type) => type === value)
}
