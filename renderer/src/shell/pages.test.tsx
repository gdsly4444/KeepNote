// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { KeepNoteBridge, LibraryStatus, MarkdownDocument } from '../../../shared'
import { Shell } from './index'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
  delete window.keepnote
})

describe('document pages', () => {
  it('opens each type through its own page and leaves other files as names', async () => {
    window.keepnote = bridge(library())
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<Shell />)
      await Promise.resolve()
    })
    const side = container.querySelector('.shell-files')
    expect(side?.textContent).toContain('图.pdf')
    expect(side?.querySelector('.file-glyph')).not.toBeNull()
    expect([...side!.querySelectorAll('button')].map((button) => button.textContent)).not.toContain('图.pdf')
    await click(container, '今天.md')
    expect(container.querySelector('.work-page')).not.toBeNull()
    expect(container.querySelector('.journal-page')).toBeNull()
    expect(container.querySelector('.essay-page')).toBeNull()
    expect(container.querySelector('.shell-files')?.textContent).not.toContain('图.pdf')

    await click(container, '登录跳转')
    expect(container.querySelector('.essay-page')).not.toBeNull()
    expect(container.querySelector('.work-page')).toBeNull()
    expect(container.querySelector('.shell-files')?.textContent).toContain('图.pdf')
    await click(container, '打包.md')
    expect(container.querySelector('.list-page')).not.toBeNull()
    expect(container.querySelector('.essay-page')).toBeNull()
    await click(container, '命令.md')
    expect(container.querySelector('.tech-page')).not.toBeNull()
    expect(container.querySelector('.list-page')).toBeNull()
    await click(container, '日记.md')
    expect(container.querySelector('.journal-page')).not.toBeNull()
    expect(container.querySelector('.tech-page')).toBeNull()
  })
})

function library(): LibraryStatus {
  return {
    state: 'ready',
    entries: [
      doc('work', '今天.md', '2026-11-14', workBody),
      doc('essay', '登录跳转.md', '登录跳转', '---\ntype: essay\n---\n\n# 登录跳转\n'),
      doc('journal', '日记.md', '2026-11-14', '---\ntype: journal\n---\n\n# 2026-11-14\n\n## 09:10\n'),
      doc('list', '打包.md', '打包', '---\ntype: list\n---\n\n# 打包\n'),
      doc('tech', '命令.md', '命令', '# 命令\n'),
      { kind: 'file', path: '图.pdf', name: '图.pdf' }
    ]
  }
}

const workBody = [
  '---',
  'type: work',
  '---',
  '',
  '# 2026-11-14',
  '',
  '## 在做',
  '',
  '## 记录',
  '',
  '## 产出',
  '',
  '- [[登录跳转]]',
  '',
  '## 留下',
  ''
].join('\n')

function doc(type: MarkdownDocument['type'], name: string, title: string, body: string): MarkdownDocument {
  return { kind: 'markdown', path: name, name, type, typeSource: 'marked', title, body, outline: [] }
}

function bridge(status: LibraryStatus): KeepNoteBridge {
  return {
    async run() {
      return { ok: true, value: null }
    },
    async query() {
      return { ok: true, value: status }
    },
    subscribe() {
      return () => undefined
    }
  }
}

async function click(container: ParentNode, name: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === name)
  if (!button) throw new Error(`没有${name}`)
  await act(async () => button.click())
}
