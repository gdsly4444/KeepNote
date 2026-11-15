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
    expect(markup(noteStatus(), vi.fn())).toContain('class="library-file"')
    expect(markup(noteStatus(), vi.fn(), '没有')).toContain('没有相符的')
    expect(markup(noteStatus(), vi.fn(), '没有')).not.toContain('a.md')
    expect(markup(noteStatus(), vi.fn(), '标题')).toContain('a.md')
    expect(pdf).not.toContain('class="library-file"')
  })
})

function markup(status: LibraryStatus, onSelect?: (path: string) => void, query = ''): string {
  return renderToStaticMarkup(createElement(LibraryView, { status, query, onOpen: vi.fn(), onSelect }))
}

function noteStatus(): LibraryStatus {
  return {
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
  }
}
