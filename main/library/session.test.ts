import { describe, expect, it, vi } from 'vitest'
import { parseMarkdown } from '../documents'
import type { ListedFile, VaultDirectory } from '../vault'
import { createLibrarySession } from './index'

describe('createLibrarySession', () => {
  it('stays closed until a folder is opened and treats a folder with no files as empty', async () => {
    const directory = memory({})
    const session = createLibrarySession(directory, parseMarkdown)
    expect(await session.current()).toEqual({ state: 'closed' })
    expect(await session.open(null)).toEqual({ ok: true, value: null })
    expect(await session.current()).toEqual({ state: 'closed' })
    expect(await session.open('/vault')).toEqual({ ok: true, value: null })
    expect(await session.current()).toEqual({ state: 'empty' })
  })

  it('lists a non-markdown file without reading it, so the library is not empty', async () => {
    const directory = memory({ 'brief.pdf': new Uint8Array([1, 2, 3]) })
    const session = createLibrarySession(directory, parseMarkdown)
    await session.open('/vault')
    const status = await session.current()
    expect(status).toEqual({
      state: 'ready',
      entries: [{ kind: 'file', path: 'brief.pdf', name: 'brief.pdf' }]
    })
    expect(directory.reads).toEqual([])
  })

  it('reads markdown into a document and reports a read failure', async () => {
    const directory = memory({ 'notes/a.md': '# 标题\r\n\r\n正文' })
    const session = createLibrarySession(directory, parseMarkdown)
    await session.open('/vault')
    const ready = await session.current()
    expect(ready.state).toBe('ready')
    if (ready.state !== 'ready') return
    expect(ready.entries[0]).toMatchObject({
      kind: 'markdown',
      path: 'notes/a.md',
      type: 'essay',
      typeSource: 'default',
      title: '标题',
      body: '# 标题\n\n正文'
    })

    directory.failRead = true
    expect(await session.current()).toEqual({ state: 'failed', message: '读不到 notes/a.md' })
  })

  it('shows a failure when the folder cannot be listed', async () => {
    const directory = memory({})
    directory.listFiles = async () => {
      throw new Error('这个文件夹读不了')
    }
    const session = createLibrarySession(directory, parseMarkdown)
    expect(await session.open('/vault')).toEqual({
      ok: false,
      code: 'library-unreadable',
      message: '这个文件夹读不了'
    })
    expect(await session.current()).toEqual({ state: 'failed', message: '这个文件夹读不了' })
  })

  it('asks the interface to reload after a file change', async () => {
    const directory = memory({})
    const session = createLibrarySession(directory, parseMarkdown)
    const listener = vi.fn()
    session.subscribe(listener)
    await session.open('/vault')
    expect(listener).toHaveBeenCalledOnce()
    directory.emit()
    expect(listener).toHaveBeenCalledTimes(2)
    session.close()
    directory.emit()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

function memory(initial: Record<string, string | Uint8Array>): VaultDirectory & {
  reads: string[]
  failRead: boolean
  emit: () => void
} {
  let onChange: (() => void) | null = null
  const directory = {
    reads: [] as string[],
    failRead: false,
    async listFiles(): Promise<ListedFile[]> {
      return Object.keys(initial)
        .sort()
        .map((path) => ({
          path,
          name: path.slice(path.lastIndexOf('/') + 1),
          markdown: typeof initial[path] === 'string',
          modifiedMs: 0
        }))
    },
    async readMarkdown(_root: string, relativePath: string): Promise<string> {
      directory.reads.push(relativePath)
      if (directory.failRead) throw new Error(`读不到 ${relativePath}`)
      const text = initial[relativePath]
      if (typeof text !== 'string') throw new Error(`读不到 ${relativePath}`)
      return text
    },
    watch(_root: string, listener: () => void): () => void {
      onChange = listener
      return () => {
        if (onChange === listener) onChange = null
      }
    },
    emit() {
      onChange?.()
    }
  }
  return directory
}
