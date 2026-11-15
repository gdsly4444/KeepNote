// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { KeepNoteBridge } from '../../../shared'
import { WorkPage } from './index'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const body = [
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
  '- 10:12 修了登录跳转 [[登录跳转]]',
  '- 15:40 把打包清单收成三组 [[本周打包]]',
  '## 23:11',
  '',
  '## 产出',
  '',
  '- [[登录跳转]]',
  '',
  '## 留下',
  '',
  '- [ ] 补空状态',
  ''
].join('\n')

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('WorkPage', () => {
  it('keeps four section titles and shows names, times, and tasks', async () => {
    const saved: string[] = []
    const opened: string[] = []
    const { container } = await render(bridge(saved), (title) => opened.push(title))
    expect([...container.querySelectorAll('h2')].map((heading) => heading.textContent)).toEqual(['在做', '记录', '产出', '留下'])
    expect(container.querySelector('.work-raw')?.textContent).toBe('## 23:11')
    expect([...container.querySelectorAll('.work-time')].map((cell) => cell.textContent)).toEqual(['10:12', '15:40'])
    expect(container.querySelector('.journal-page')).toBeNull()
    const output = [...container.querySelectorAll('button')].find((button) => button.textContent === '登录跳转')
    output?.click()
    expect(opened).toEqual(['登录跳转'])
    expect(container.textContent).not.toContain('[[登录跳转]]')

    const box = container.querySelector('input[type="checkbox"]')
    if (!(box instanceof HTMLInputElement)) throw new Error('没有任务')
    await act(async () => box.click())
    await flush()
    expect(saved.at(-1)).toContain('- [x] 补空状态')
    expect(container.querySelector('.work-task')?.getAttribute('data-done')).toBe('true')
  })

  it('does not save a composed character until composition ends', async () => {
    const saved: string[] = []
    const { container } = await render(bridge(saved))
    const field = container.querySelector('textarea')
    if (!(field instanceof HTMLTextAreaElement)) throw new Error('没有在做')
    await act(async () => {
      field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    })
    await typeInto(field, '写一页中')
    await flush()
    expect(saved).toEqual([])
    expect(field.value).toContain('中')
    await act(async () => {
      field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    })
    await flush()
    expect(saved.at(-1)).toContain('写一页中')
  })

  it('returns the caret to the same section after source mode', async () => {
    const { container } = await render(bridge([]))
    const left = container.querySelector('[aria-label="留下 补空状态"]')
    if (!(left instanceof HTMLInputElement)) throw new Error('没有留下')
    await act(async () => left.focus())
    await click(container, '源码')
    const field = sourceField(container)
    const caret = field.value.indexOf('- [ ] 补空状态')
    expect(field.value.split('\n')[sourceLine(field.value, field.selectionStart)]).toBe('- [ ] 补空状态')
    field.setSelectionRange(field.value.indexOf('登录跳转'), field.value.indexOf('登录跳转'))
    const scrolled: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this)
    }
    try {
      await click(container, '排版')
    } finally {
      Element.prototype.scrollIntoView = original
    }
    const doing = container.querySelector('[aria-label="在做"]')
    expect(document.activeElement).toBe(doing)
    expect(scrolled).toContain(doing)
    await click(container, '源码')
    expect(sourceField(container).selectionStart).toBe(field.value.indexOf('登录跳转'))
    field.setSelectionRange(caret, caret)
    expect(sourceField(container).value.split('\n')[sourceLine(sourceField(container).value, caret)]).toBe('- [ ] 补空状态')
  })

  it('keeps the caret on the same line inside 在做', async () => {
    const { container } = await render(bridge([]))
    const doing = container.querySelector('[aria-label="在做"]')
    if (!(doing instanceof HTMLTextAreaElement)) throw new Error('没有在做')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(doing, '登录跳转\n第二行')
      doing.dispatchEvent(new Event('input', { bubbles: true }))
    })
    doing.setSelectionRange(doing.value.indexOf('第二行'), doing.value.indexOf('第二行'))
    await click(container, '源码')
    const field = sourceField(container)
    expect(field.value.split('\n')[sourceLine(field.value, field.selectionStart)]).toBe('第二行')
    const back = field.value.indexOf('登录跳转')
    field.setSelectionRange(back, back)
    await click(container, '排版')
    const again = container.querySelector('[aria-label="在做"]')
    if (!(again instanceof HTMLTextAreaElement)) throw new Error('没有回到在做')
    expect(again.selectionStart).toBe(0)
    expect(again.value.startsWith('登录跳转')).toBe(true)
  })
})

async function render(bridgeImpl: KeepNoteBridge, onOpenTitle?: (title: string) => void) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<WorkPage path="work/2026/11/2026-11-14.md" body={body} bridge={bridgeImpl} onOpenTitle={onOpenTitle} saveDelay={0} />)
  })
  return { container }
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

async function typeInto(field: HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

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

function sourceLine(value: string, offset: number): number {
  return value.slice(0, offset).split('\n').length - 1
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}
