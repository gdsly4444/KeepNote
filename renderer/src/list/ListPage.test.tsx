// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { KeepNoteBridge } from '../../../shared'
import { ListPage } from './index'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const body = [
  '---',
  'type: list',
  '---',
  '',
  '# 打包',
  '',
  '## 今天',
  '',
  '- [ ] 第一项',
  '- [x] 做完的',
  '',
  '散落的一句',
  ''
].join('\n')

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('ListPage', () => {
  it('edits tasks in place and lowers the contrast of finished ones', async () => {
    const saved: string[] = []
    const { container } = await render(bridge(saved))
    expect([...container.querySelectorAll('button')].some((button) => button.textContent === '源码')).toBe(false)
    expect(container.querySelector('[data-mode]')).toBeNull()
    const done = container.querySelector('.list-task[data-done="true"] [aria-label="任务"]')
    expect(done).toBeInstanceOf(HTMLInputElement)
    expect((done as HTMLInputElement).value).toBe('做完的')
    expect(container.textContent).toContain('未归类')

    const first = taskField(container, '第一项')
    await key(first, 'Enter')
    const created = container.querySelector('[data-row="2"]')
    if (!(created instanceof HTMLInputElement)) throw new Error('没有新的一项')
    await typeInto(created, '子项')
    await key(created, 'Tab')
    expect(container.querySelector('[data-depth="1"]')).not.toBeNull()
    await key(created, 'Enter', { ctrlKey: true })
    expect(container.querySelector('[data-depth="1"]')?.getAttribute('data-done')).toBe('true')

    const convert = [...container.querySelectorAll('button')].find((button) => button.textContent === '收成任务项')
    if (!convert) throw new Error('没有收成任务项')
    await act(async () => convert.click())
    await flush()
    const text = saved.at(-1) ?? ''
    expect(text).toContain('- [ ] 第一项')
    expect(text).toContain('  - [x] 子项')
    expect(text).toContain('- [ ] 散落的一句')
    expect(text.indexOf('第一项')).toBeLessThan(text.indexOf('子项'))
  })

  it('does not split a row while a character is composing', async () => {
    const { container } = await render(bridge([]))
    const first = taskField(container, '第一项')
    await act(async () => {
      first.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    })
    await key(first, 'Enter')
    expect(container.querySelectorAll('[aria-label="任务"]')).toHaveLength(2)
  })
})

function taskField(container: ParentNode, value: string): HTMLInputElement {
  const field = [...container.querySelectorAll('input')].find((item) => item instanceof HTMLInputElement && item.value === value)
  if (!(field instanceof HTMLInputElement)) throw new Error(`没有${value}`)
  return field
}

async function render(bridgeImpl: KeepNoteBridge) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<ListPage path="打包.md" body={body} bridge={bridgeImpl} saveDelay={0} />)
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

async function key(field: HTMLInputElement, name: string, init: KeyboardEventInit = {}): Promise<void> {
  await act(async () => {
    field.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, ...init }))
  })
}

async function typeInto(field: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}
