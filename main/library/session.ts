import type { BridgeResult, LibraryEntry, LibraryStatus, MarkdownDocument } from '../../shared'
import type { VaultDirectory } from '../vault'

export type ParseMarkdown = (file: { path: string; name: string }, source: string) => MarkdownDocument

export interface LibrarySession {
  current(): Promise<LibraryStatus>
  open(root: string | null): Promise<BridgeResult<null>>
  subscribe(listener: () => void): () => void
  close(): void
}

export function createLibrarySession(directory: VaultDirectory, parse: ParseMarkdown): LibrarySession {
  let root: string | null = null
  let failure: string | null = null
  let stopWatch: (() => void) | null = null
  const listeners = new Set<() => void>()

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    async current() {
      if (!root) return { state: 'closed' }
      if (failure) return { state: 'failed', message: failure }
      try {
        const files = [...(await directory.listFiles(root))].sort((left, right) =>
          comparePath(left.path, right.path)
        )
        if (files.length === 0) return { state: 'empty' }
        const entries: LibraryEntry[] = []
        for (const file of files) {
          if (!file.markdown) {
            entries.push({ kind: 'file', path: file.path, name: file.name })
            continue
          }
          const text = await directory.readMarkdown(root, file.path)
          entries.push(parse({ path: file.path, name: file.name }, text))
        }
        return { state: 'ready', entries }
      } catch (error) {
        return { state: 'failed', message: readable(error) }
      }
    },
    async open(next) {
      if (next === null) return { ok: true, value: null }
      stopWatch?.()
      stopWatch = null
      try {
        await directory.listFiles(next)
      } catch (error) {
        root = next
        failure = readable(error)
        emit()
        return { ok: false, code: 'library-unreadable', message: failure }
      }
      root = next
      failure = null
      stopWatch = directory.watch(next, () => {
        failure = null
        emit()
      })
      emit()
      return { ok: true, value: null }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    close() {
      stopWatch?.()
      stopWatch = null
    }
  }
}

function readable(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '这个文件夹读不了'
}

function comparePath(left: string, right: string): number {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
