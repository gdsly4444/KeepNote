import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createNoteIndex, followLibrary, type IndexFile, type IndexSource } from './index'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('createNoteIndex', () => {
  it('looks up a cached title without reading every note again', async () => {
    const files = Array.from({ length: 10_000 }, (_, index) => file(`n${index}.md`, 1_700_000_000_000))
    const source = memory(files)
    const root = await makeRoot()
    const first = createNoteIndex({ file: join(root, 'index.sqlite'), source, titles })
    await first.refresh()
    expect(source.reads).toBe(10_000)
    first.close()

    source.reads = 0
    const again = createNoteIndex({ file: join(root, 'index.sqlite'), source, titles })
    await again.refresh()
    expect(again.findByName('标题n42')).toMatchObject([{ path: 'n42.md', title: '标题n42' }])
    expect(source.reads).toBe(0)
    again.close()
  })

  it('rereads only the note whose modification time changed', async () => {
    const files = [file('a.md', 1_700_000_000_000), file('b.md', 1_700_000_000_000)]
    const source = memory(files)
    const index = createNoteIndex({ file: join(await makeRoot(), 'index.sqlite'), source, titles })
    await index.refresh()
    source.reads = 0
    source.bodies.set('b.md', '# 改过\n')
    files[1] = file('b.md', 1_700_000_100_000)
    await index.refresh()
    expect(source.reads).toBe(1)
    expect(index.findByName('改过')).toMatchObject([{ path: 'b.md' }])
    index.close()
  })

  it('lists notes modified today and ignores one that was only opened', async () => {
    const fresh = Date.now()
    const stale = fresh - 10 * 24 * 60 * 60 * 1000
    const files = [file('今天.md', fresh), file('旧.md', stale)]
    const source = memory(files)
    const index = createNoteIndex({ file: join(await makeRoot(), 'index.sqlite'), source, titles })
    await index.refresh()
    source.reads = 0
    await source.read('旧.md')
    expect(source.reads).toBe(1)
    source.reads = 0
    await index.refresh()
    expect(index.changedOn(day(fresh)).map((note) => note.path)).toEqual(['今天.md'])
    expect(source.reads).toBe(0)
    index.close()
  })

  it('refreshes when the library says something changed', async () => {
    const files = [file('a.md', Date.now())]
    const source = memory(files)
    const index = createNoteIndex({ file: join(await makeRoot(), 'index.sqlite'), source, titles })
    let pending = Promise.resolve()
    const listeners = new Set<() => void>()
    followLibrary(
      {
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      {
        refresh() {
          pending = index.refresh()
          return pending
        }
      }
    )
    for (const listener of listeners) listener()
    await pending
    expect(index.findByName('标题a')).toMatchObject([{ path: 'a.md' }])
    index.close()
  })
})

function file(name: string, mtimeMs: number): IndexFile {
  return { path: name, name, mtimeMs }
}

function titles(_file: { path: string; name: string }, source: string): { title: string; type: 'essay' } {
  const heading = /^# (.*)$/m.exec(source)
  return { title: heading?.[1]?.trim() || '无题', type: 'essay' }
}

function memory(files: IndexFile[]): IndexSource & { reads: number; bodies: Map<string, string> } {
  const bodies = new Map(files.map((item) => [item.path, `# 标题${item.name.replace(/\.md$/i, '')}\n`]))
  const source = {
    reads: 0,
    bodies,
    async list() {
      return files.map((item) => ({ ...item }))
    },
    async read(path: string) {
      source.reads += 1
      const text = bodies.get(path)
      if (text === undefined) throw new Error(`读不到 ${path}`)
      return text
    }
  }
  return source
}

function day(mtimeMs: number): string {
  const date = new Date(mtimeMs)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${dayOfMonth}`
}

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'keepnote-index-'))
  roots.push(root)
  return root
}
