// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { KeepNoteBridge } from '../../../shared'
import { JournalPage } from './index'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const body = [
  '---',
  'type: journal',
  '---',
  '',
  '# 2026-11-14',
  '',
  '## 09:10',
  '',
  '早上的一段。',
  '',
  '## 12:00',
  '',
  '中午还在。',
  ''
].join('\n')

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('JournalPage', () => {
  it('focuses the next entry and appends it after the existing ones', async () => {
    const saved: string[] = []
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<JournalPage path="journal/2026/11/2026-11-14.md" body={body} bridge={bridge(saved)} saveDelay={0} />)
    })
    const field = document.activeElement
    if (!(field instanceof HTMLInputElement)) throw new Error('插入符不在新条目上')
    expect(field.getAttribute('aria-label')).toBe('新的一条')
    const prose = container.querySelector('.ProseMirror')
    expect(prose?.getAttribute('contenteditable')).toBe('true')
    expect(prose?.textContent).toContain('早上的一段')
    expect(container.querySelector('.work-page')).toBeNull()

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(field, '晚上')
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const text = saved.at(-1) ?? ''
    expect(text.indexOf('早上的一段')).toBeLessThan(text.indexOf('中午还在'))
    expect(text.indexOf('中午还在')).toBeLessThan(text.indexOf('晚上'))
    expect(text).toMatch(/## \d{2}:\d{2}\n\n晚上\n$/)
  })

  it('keeps the caret on the same entry and saves an edit from source', async () => {
    const saved: string[] = []
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<JournalPage path="journal/2026/11/2026-11-14.md" body={body} bridge={bridge(saved)} saveDelay={0} />)
    })
    await click(container, '源码')
    const field = sourceField(container)
    const caret = field.value.indexOf('中午还在')
    field.setSelectionRange(caret, caret)
    const scrolled: string[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.textContent ?? '')
    }
    try {
      await click(container, '排版')
    } finally {
      Element.prototype.scrollIntoView = original
    }
    expect(scrolled.some((item) => item.includes('中午'))).toBe(true)
    await click(container, '源码')
    const again = sourceField(container)
    expect(again.selectionStart).toBe(caret)
    expect(again.scrollTop).toBeGreaterThan(0)
    await typeSource(again, again.value.replace('早上的一段。', '早上改了。'))
    await click(container, '排版')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('.ProseMirror')?.textContent).toContain('早上改了')
    expect(saved.at(-1)).toContain('早上改了')
    expect(saved.at(-1)).toContain('中午还在')
  })
})

async function click(container: ParentNode, name: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === name)
  if (!button) throw new Error(`没有${name}`)
  await act(async () => button.click())
}

function sourceField(container: ParentNode): HTMLTextAreaElement {
  const field = container.querySelector('[aria-label="源码"]')
  if (!(field instanceof HTMLTextAreaElement)) throw new Error('没有源码')
  return field
}

async function typeSource(field: HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function bridge(saved: string[]): KeepNoteBridge {
  return {
    async run(_command, args) {
      saved.push(args?.text ?? '')
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
