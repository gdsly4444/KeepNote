import { describe, expect, it } from 'vitest'
import { parseMarkdown } from './index'

describe('parseMarkdown', () => {
  it('defaults a missing or unknown type to essay and says so', () => {
    const missing = parseMarkdown({ path: 'notes/a.md', name: 'a.md' }, '# 标题\n\n正文')
    expect(missing.type).toBe('essay')
    expect(missing.typeSource).toBe('default')
    expect(missing.title).toBe('标题')

    const unknown = parseMarkdown({ path: 'notes/a.md', name: 'a.md' }, '---\ntype: novel\n---\n')
    expect(unknown.type).toBe('essay')
    expect(unknown.typeSource).toBe('default')
    expect(unknown.title).toBe('a')
  })

  it('reads a marked type, date titles, and headings outside fences', () => {
    const work = parseMarkdown(
      { path: 'work/2026/11/2026-11-14.md', name: '2026-11-14.md' },
      '---\ntype: work\n---\n# 在做\n\n```\n# 不是标题\n```\n\n## 记录\n'
    )
    expect(work.type).toBe('work')
    expect(work.typeSource).toBe('marked')
    expect(work.title).toBe('2026-11-14')
    expect(work.outline).toEqual([
      { level: 1, text: '在做' },
      { level: 2, text: '记录' }
    ])
    expect(work.body.includes('\r')).toBe(false)
  })

  it('stores LF when the file used CRLF', () => {
    const document = parseMarkdown({ path: 'a.md', name: 'a.md' }, '# 标题\r\n\r\n一行')
    expect(document.body).toBe('# 标题\n\n一行')
  })
})
