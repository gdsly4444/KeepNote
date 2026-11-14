import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LibraryStatus } from '../../../shared'
import { LibraryView } from './index'

describe('LibraryView', () => {
  it('shows the folder choice, an empty library, and a read failure', () => {
    expect(markup({ state: 'closed' })).toContain('选择文件夹')
    expect(markup({ state: 'empty' })).toContain('库是空的')
    expect(markup({ state: 'failed', message: '这个文件夹读不了' })).toContain('这个文件夹读不了')
  })

  it('shows a non-markdown file by name and does not render markdown bytes', () => {
    const pdf = markup({
      state: 'ready',
      entries: [{ kind: 'file', path: 'brief.pdf', name: 'brief.pdf' }]
    })
    expect(pdf).toContain('brief.pdf')
    expect(pdf).not.toContain('库是空的')

    const note = markup({
      state: 'ready',
      entries: [
        {
          kind: 'markdown',
          path: 'a.md',
          name: 'a.md',
          type: 'essay',
          typeSource: 'default',
          title: '标题',
          body: '秘密正文',
          outline: []
        }
      ]
    })
    expect(note).toContain('a.md')
    expect(note).not.toContain('秘密正文')
  })
})

function markup(status: LibraryStatus): string {
  return renderToStaticMarkup(createElement(LibraryView, { status, onOpen: vi.fn() }))
}
