// @vitest-environment happy-dom
import { EditorView } from '@codemirror/view'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { KeepNoteBridge } from '../../../shared'
import { TechPage } from './index'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const body = '# 命令\n\n```ts\nconst answer = 1\n```\n'

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('TechPage', () => {
  it('opens as source and does not draw the code block list', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<TechPage path="命令.md" body={body} bridge={bridge()} saveDelay={0} />)
    })
    expect(container.querySelector('.tech-page')?.getAttribute('data-mode')).toBe('source')
    expect(container.querySelector('.cm-editor')).not.toBeNull()
    expect(container.querySelector('[aria-label="源码"]')?.textContent).toContain('const answer = 1')
    expect(container.querySelector('.tech-blocks')).toBeNull()
    expect(container.querySelector('.cm-content')?.textContent).toContain('```')
  })

  it('shows a preview beside the source and leaves the caret where it was', async () => {
    const note = '# 命令\n\n把端口转发出去。\n\n```sh\nls\n```\n\n| 名称 | 值 |\n| --- | --- |\n| 端口 | 8080 |\n'
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<TechPage path="命令.md" body={note} bridge={bridge()} saveDelay={0} />)
    })
    const host = container.querySelector('.cm-editor')
    if (!(host instanceof HTMLElement)) throw new Error('没有源码')
    const view = EditorView.findFromDOM(host)
    if (!view) throw new Error('没有编辑器')
    const anchor = note.indexOf('ls')
    view.dispatch({ selection: { anchor } })
    await click(container, '预览')
    const live = EditorView.findFromDOM(host)
    expect(container.querySelector('.cm-editor')).toBe(host)
    expect(live).toBe(view)
    expect(container.querySelector('.tech-page')?.getAttribute('data-mode')).toBe('source')
    expect(live?.state.selection.main.anchor).toBe(anchor)
    expect(container.querySelector('.cm-content')?.textContent).toContain('```')
    expect(container.querySelector('.tech-preview pre')?.textContent).toBe('ls')
    expect(container.querySelector('.tech-preview p')?.textContent).toBe('把端口转发出去。')
    expect(container.querySelector('.tech-preview table')?.textContent).toContain('8080')
  })
})

async function click(container: ParentNode, name: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === name)
  if (!button) throw new Error(`没有${name}`)
  await act(async () => button.click())
}

function bridge(): KeepNoteBridge {
  return {
    async run() {
      return { ok: true, value: { path: '', title: '', created: false, message: '已保存' } }
    },
    async query() {
      return { ok: true, value: null }
    },
    subscribe() {
      return () => undefined
    }
  }
}
