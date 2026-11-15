import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from '../../../shared'
import { contextItems, fileKind, recentNotes } from './model'

describe('sidebar model', () => {
  it('keeps the latest dated notes and marks other files by kind', () => {
    const entries: LibraryEntry[] = [
      note('work', 'work/2026/11/2026-11-14.md', '2026-11-14'),
      note('work', 'work/2026/11/2026-11-13.md', '2026-11-13'),
      note('journal', 'journal/2026/11/2026-11-14.md', '2026-11-14'),
      note('essay', '登录跳转.md', '登录跳转'),
      { kind: 'file', path: '图.pdf', name: '图.pdf' }
    ]
    expect(recentNotes(entries, 'work').map((item) => item.title)).toEqual(['2026-11-14', '2026-11-13'])
    expect(recentNotes(entries, 'journal')).toHaveLength(1)
    expect(fileKind('图.pdf')).toBe('pdf')
    expect(fileKind('封面.png')).toBe('image')
    expect(fileKind('备注.txt')).toBe('file')
  })

  it('lists essay headings, list groups, and tech code blocks', () => {
    expect(contextItems('list', [{ level: 1, text: '打包' }, { level: 2, text: '发出' }], [])).toEqual([
      { id: 'heading-0', label: '打包', kind: 'heading', text: '打包', index: 0, line: 0 },
      { id: 'heading-1', label: '发出', kind: 'heading', text: '发出', index: 0, line: 0 }
    ])
    expect(contextItems('essay', [{ level: 2, text: '决定' }, { level: 2, text: '决定' }], []).map((item) => item.index)).toEqual([0, 1])
    expect(contextItems('tech', [{ level: 1, text: '命令' }], [{ language: 'sh', firstLine: 'ls', line: 5 }])).toEqual([
      { id: 'heading-0', label: '命令', kind: 'heading', text: '命令', index: 0, line: 0 },
      { id: 'code-0', label: 'sh ls', kind: 'code', text: 'ls', index: 0, line: 5 }
    ])
  })
})

function note(type: 'work' | 'journal' | 'essay', path: string, title: string): LibraryEntry {
  return {
    kind: 'markdown',
    path,
    name: path.split('/').pop() ?? path,
    type,
    typeSource: 'marked',
    title,
    body: '',
    outline: []
  }
}
