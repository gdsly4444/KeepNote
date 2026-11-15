import type { DocumentType } from '../../shared'
import { openCache, type CachedNote } from './cache'

export interface IndexFile {
  path: string
  name: string
  mtimeMs: number
}

export interface IndexSource {
  list(): Promise<IndexFile[]>
  read(path: string): Promise<string>
}

export interface IndexedNote {
  path: string
  name: string
  title: string
  type: DocumentType
  mtimeMs: number
}

export interface NoteIndex {
  refresh(): Promise<void>
  all(): IndexedNote[]
  findByName(name: string): IndexedNote[]
  changedOn(day: string): IndexedNote[]
  close(): void
}

export function createNoteIndex(input: {
  file: string
  source: IndexSource
  titles(file: { path: string; name: string }, source: string): { title: string; type: DocumentType }
}): NoteIndex {
  const cache = openCache(input.file)
  let notes: IndexedNote[] = []
  let chain = Promise.resolve()

  const rebuild = async (): Promise<void> => {
    const files = (await input.source.list()).filter((file) => file.name.toLowerCase().endsWith('.md'))
    const stored = new Map(cache.read().map((note) => [note.path, note]))
    const next: CachedNote[] = []
    for (const file of files) {
      const previous = stored.get(file.path)
      const mtimeMs = Math.trunc(file.mtimeMs)
      if (previous && previous.mtimeMs === mtimeMs && previous.name === file.name) {
        next.push(previous)
        continue
      }
      let text: string
      try {
        text = await input.source.read(file.path)
      } catch {
        if (previous) next.push(previous)
        continue
      }
      const title = input.titles({ path: file.path, name: file.name }, text)
      next.push({ path: file.path, name: file.name, title: title.title, type: title.type, mtimeMs })
    }
    cache.replace(next)
    notes = next.map((note) => ({ ...note }))
  }

  return {
    refresh() {
      const run = chain.then(rebuild)
      chain = run.then(() => undefined, () => undefined)
      return run
    },
    all() {
      return notes.map((note) => ({ ...note }))
    },
    findByName(name) {
      const needle = name.trim()
      const lower = needle.toLowerCase()
      if (!needle) return []
      return notes.filter((note) => {
        const stem = note.name.replace(/\.md$/i, '')
        return note.title === needle || stem.toLowerCase() === lower || note.name.toLowerCase() === lower
      }).map((note) => ({ ...note }))
    },
    changedOn(day) {
      return notes.filter((note) => dayOf(note.mtimeMs) === day).map((note) => ({ ...note }))
    },
    close() {
      cache.close()
    }
  }
}

export function followLibrary(
  events: { subscribe(listener: () => void): () => void },
  index: { refresh(): Promise<void> }
): () => void {
  return events.subscribe(() => {
    void index.refresh().then(() => undefined, () => undefined)
  })
}

function dayOf(mtimeMs: number): string {
  const date = new Date(mtimeMs)
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}

function two(value: number): string {
  return String(value).padStart(2, '0')
}
