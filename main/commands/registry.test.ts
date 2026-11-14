import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../documents'
import type { ListedFile } from '../vault'
import { createCommandRegistry, systemClock, type CommandClock, type NoteStore, type RegisteredCommand } from './index'

const workPath = 'work/2026/11/2026-11-14.md'
const journalPath = 'journal/2026/11/2026-11-14.md'

describe('command registry', () => {
  it('creates today once and leaves the existing note untouched', async () => {
    const notes = memoryNotes()
    const registry = registryWith(notes)
    const created = await registry.execute('today')
    const again = await registry.execute('today')

    expect(created).toEqual({
      ok: true,
      value: { path: workPath, title: '2026-11-14', created: true, message: '写下了今天的工作记录' }
    })
    expect(again).toMatchObject({ ok: true, value: { created: false, message: '今天的工作记录已经在了' } })
    expect(notes.files.get(workPath)).toBe(
      note(['---', 'type: work', '---', '', '# 2026-11-14', '', '## 在做', '', '## 记录', '', '## 产出', '', '## 留下'])
    )
    expect(notes.writes).toEqual([workPath])
  })

  it('creates one blank diary entry and does not replace it later the same day', async () => {
    const notes = memoryNotes()
    const clock = frozenClock()
    const registry = registryWith(notes, clock)
    expect(await registry.execute('diary')).toMatchObject({ ok: true, value: { path: journalPath, created: true } })
    clock.at = '15:40'
    const again = await registry.execute('diary')

    expect(again).toMatchObject({ ok: true, value: { created: false, message: '今天的日记已经在了' } })
    expect(notes.files.get(journalPath)).toBe(
      note(['---', 'type: journal', '---', '', '# 2026-11-14', '', '## 10:12'])
    )
    expect(notes.writes).toEqual([journalPath])
  })

  it('appends a log from another document, then now and leave edit only their sections', async () => {
    const essay = ['---', 'type: essay', '---', '', '# 周会', '', '正文', ''].join('\n') + '\n'
    const notes = memoryNotes({ '周会.md': essay })
    const clock = frozenClock()
    const registry = registryWith(notes, clock)

    const first = await registry.execute('log', { text: '修了登录跳转', currentPath: '周会.md' })
    clock.at = '15:40'
    await registry.execute('log', { text: '补了一处', currentPath: '周会.MD' })
    await registry.execute('now', { text: '登录跳转' })
    await registry.execute('leave', { text: '补空状态' })
    const today = await registry.execute('today')

    expect(first).toMatchObject({
      ok: true,
      value: { path: workPath, created: true, message: '10:12 已记入今天' }
    })
    expect(today).toMatchObject({ ok: true, value: { created: false } })
    expect(notes.files.get(workPath)).toBe(
      note([
        '---',
        'type: work',
        '---',
        '',
        '# 2026-11-14',
        '',
        '## 在做',
        '',
        '登录跳转',
        '',
        '## 记录',
        '',
        '- 10:12 修了登录跳转 [[周会]]',
        '- 15:40 补了一处 [[周会]]',
        '',
        '## 产出',
        '',
        '## 留下',
        '',
        '- [ ] 补空状态'
      ])
    )
    expect(notes.files.get('周会.md')).toBe(essay)
    expect(notes.writes).toEqual([workPath, workPath, workPath, workPath])
  })

  it('replaces the current sentence and appends another unfinished task', async () => {
    const notes = memoryNotes()
    const registry = registryWith(notes)
    await registry.execute('now', { text: '登录跳转' })
    await registry.execute('now', { text: '空状态' })
    await registry.execute('leave', { text: '补空状态' })
    await registry.execute('leave', { text: '写测试' })
    const body = notes.files.get(workPath) ?? ''
    expect(body).toContain('## 在做\n\n空状态\n\n## 记录')
    expect(body).not.toContain('登录跳转')
    expect(body).toContain('- [ ] 补空状态\n- [ ] 写测试\n')
  })

  it('logs without a current document and refuses to invent a missing section', async () => {
    const notes = memoryNotes()
    const registry = registryWith(notes)
    await registry.execute('log', { text: '只记一句' })
    expect(notes.files.get(workPath)).toContain('- 10:12 只记一句\n')
    expect(notes.files.get(workPath)).not.toContain('[[')

    notes.files.set(workPath, '---\ntype: work\n---\n\n# 2026-11-14\n\n## 在做\n')
    const broken = await registry.execute('log', { text: '写不进去' })
    expect(broken).toEqual({ ok: false, code: 'missing-section', message: '这篇里没有「记录」' })
    expect(notes.files.get(workPath)).not.toContain('写不进去')
  })

  it('creates an essay by title and does not overwrite it', async () => {
    const notes = memoryNotes()
    const registry = registryWith(notes)
    const created = await registry.execute('new', { type: 'essay', title: '周会' })
    const again = await registry.execute('new', { type: 'essay', title: '周会.MD' })
    const invalid = await registry.execute('new', { type: 'list', title: 'a/b' })
    const missing = await registry.execute('new', { type: 'tech' })
    const list = await registry.execute('new', { type: 'list', title: '打包' })
    const dated = await registry.execute('new', { type: 'work', title: '不该出现' })

    expect(created).toEqual({
      ok: true,
      value: { path: '周会.md', title: '周会', created: true, message: '写下了「周会」' }
    })
    expect(notes.files.get('周会.md')).toBe(note(['---', 'type: essay', '---', '', '# 周会']))
    expect(again).toEqual({ ok: false, code: 'already-exists', message: '已经有同名文档' })
    expect(invalid).toEqual({ ok: false, code: 'invalid-title', message: '这个标题不能当作文件名' })
    expect(missing).toEqual({ ok: false, code: 'missing-title', message: '缺少标题' })
    expect(list).toMatchObject({ ok: true, value: { path: '打包.md', title: '打包', created: true } })
    expect(notes.files.get('打包.md')).toBe(note(['---', 'type: list', '---', '', '# 打包']))
    expect(dated).toMatchObject({ ok: true, value: { path: workPath, created: true } })
    expect(notes.files.has('不该出现.md')).toBe(false)
  })

  it('opens a note by its path and returns a failure instead of throwing', async () => {
    const notes = memoryNotes({ 'Notes/周会.md': '---\ntype: essay\n---\n\n# 周会\n' }, ['brief.pdf'])
    const registry = registryWith(notes)

    expect(await registry.execute('open', { path: 'notes/周会.md' })).toEqual({
      ok: true,
      value: { path: 'Notes/周会.md', title: '周会', created: false, message: '打开了「周会」' }
    })
    expect(await registry.execute('open', { path: 'missing.md' })).toEqual({
      ok: false,
      code: 'not-found',
      message: '没有这篇'
    })
    expect(await registry.execute('open', { path: '../secret.md' })).toEqual({
      ok: false,
      code: 'not-found',
      message: '没有这篇'
    })
    expect(await registry.execute('open', { path: 'brief.pdf' })).toEqual({
      ok: false,
      code: 'not-markdown',
      message: '这不是笔记'
    })
    expect(await registry.execute('open')).toEqual({ ok: false, code: 'missing-path', message: '缺少要打开的文档' })
    expect(notes.reads).not.toContain('../secret.md')
  })

  it('reports a closed library and an unknown command without a window', async () => {
    const notes = memoryNotes()
    const registry = registryWith(notes, frozenClock(), () => null)
    expect(await registry.execute('today')).toEqual({ ok: false, code: 'library-closed', message: '还没有打开库' })
    expect(await registry.execute('log', { text: '不会写' })).toEqual({
      ok: false,
      code: 'library-closed',
      message: '还没有打开库'
    })
    expect(notes.writes).toEqual([])

    const open = registryWith(notes)
    expect(await open.execute('missing')).toEqual({ ok: false, code: 'unknown-command', message: '未知命令' })
    expect(await open.execute('log', { text: '   ' })).toEqual({
      ok: false,
      code: 'missing-text',
      message: '缺少要记的内容'
    })
  })

  it('runs a newly registered command through the same call', async () => {
    const notes = memoryNotes({
      '周会.md': '---\ntype: essay\n---\n\n# 周会\n',
      '清单.md': '---\ntype: list\n---\n\n# 清单\n'
    })
    const registry = registryWith(notes)
    const extra: RegisteredCommand = {
      name: 'only-list',
      appliesTo: ['list'],
      run() {
        return Promise.resolve({
          ok: true,
          value: { path: '清单.md', title: '清单', created: false, message: '可以' }
        })
      }
    }
    registry.register(extra)

    expect(await registry.execute('only-list')).toEqual({
      ok: false,
      code: 'wrong-type',
      message: '这条命令需要当前文档'
    })
    expect(await registry.execute('only-list', { currentPath: '周会.md' })).toEqual({
      ok: false,
      code: 'wrong-type',
      message: '这条命令不用于这种文档'
    })
    expect(await registry.execute('only-list', { currentPath: '清单.md' })).toMatchObject({
      ok: true,
      value: { message: '可以' }
    })
  })

  it('does not choose between two files that differ only by case', async () => {
    const notes = memoryNotes({
      'Work/2026/11/2026-11-14.md': '一',
      'work/2026/11/2026-11-14.md': '二'
    })
    const registry = registryWith(notes)
    expect(await registry.execute('today')).toEqual({ ok: false, code: 'ambiguous', message: '有多篇同名' })
    expect(await registry.execute('log', { text: '不会写' })).toEqual({
      ok: false,
      code: 'ambiguous',
      message: '有多篇同名'
    })
    expect(notes.writes).toEqual([])
    expect(notes.files.get('Work/2026/11/2026-11-14.md')).toBe('一')
    expect(notes.files.get('work/2026/11/2026-11-14.md')).toBe('二')
  })

  it('formats the system clock as a local day and minute', () => {
    const clock = systemClock()
    expect(clock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(clock.time()).toMatch(/^\d{2}:\d{2}$/)
  })

  it('keeps the command module off the disk and the window', () => {
    const directory = dirname(fileURLToPath(import.meta.url))
    const source = ['index.ts', 'registry.ts', 'text.ts']
      .map((name) => readFileSync(join(directory, name), 'utf8'))
      .join('\n')
    expect(source).not.toContain('node:fs')
    expect(source).not.toContain('electron')
    expect(source).not.toContain('BrowserWindow')
  })
})

function note(rows: string[]): string {
  return `${rows.join('\n')}\n`
}

function registryWith(notes: NoteStore, clock: CommandClock = frozenClock(), root: () => string | null = () => '/vault') {
  return createCommandRegistry({ notes, parse: parseMarkdown, root, clock })
}

function frozenClock(): CommandClock & { day: string; at: string } {
  return {
    day: '2026-11-14',
    at: '10:12',
    today() {
      return this.day
    },
    time() {
      return this.at
    }
  }
}

function memoryNotes(seed: Record<string, string> = {}, others: string[] = []): NoteStore & {
  files: Map<string, string>
  writes: string[]
  reads: string[]
} {
  const files = new Map(Object.entries(seed))
  const writes: string[] = []
  const reads: string[] = []
  const notes: NoteStore = {
    async listFiles() {
      const markdown: ListedFile[] = [...files.keys()].map((path) => ({
        path,
        name: path.slice(path.lastIndexOf('/') + 1),
        markdown: true
      }))
      const rest: ListedFile[] = others.map((path) => ({
        path,
        name: path.slice(path.lastIndexOf('/') + 1),
        markdown: false
      }))
      return [...markdown, ...rest]
    },
    async readMarkdown(_root, relativePath) {
      reads.push(relativePath)
      const found = [...files.keys()].find((path) => path.toLowerCase() === relativePath.toLowerCase())
      if (!found) throw new Error(`读不到 ${relativePath}`)
      return files.get(found) ?? ''
    },
    async writeMarkdown(_root, relativePath, text) {
      if (relativePath.includes('..')) throw new Error(`读不到 ${relativePath}`)
      writes.push(relativePath)
      const found = [...files.keys()].find((path) => path.toLowerCase() === relativePath.toLowerCase())
      files.set(found ?? relativePath, text)
    }
  }
  return Object.assign(notes, { files, writes, reads })
}
