// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { KeepNoteBridge } from '../../../shared'
import { EssayPage } from './index'
import { essayFixture } from './fixture'
import { blockOffset, splitFrontmatter } from '../prose'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ''
})

describe('EssayPage', () => {
  it('round-trips a fixed note and keeps the caret on the same block', async () => {
    const saved: string[] = []
    const { container } = await render(bridge(async (text) => {
      saved.push(text)
      return true
    }))
    expect(text(container, '.essay-status')).toBe('已保存')
    expect(container.querySelector('.essay-page')?.getAttribute('data-mode')).toBe('reading')
    expect(container.querySelector('.ProseMirror')?.getAttribute('contenteditable')).toBe('true')

    await click(container, '源码')
    const field = sourceField(container)
    expect(field.value).toBe(essayFixture)
    const parts = splitFrontmatter(essayFixture)
    const section = blockOffset(parts.content, 2)
    const caret = parts.head.length + section.offset
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
    expect(scrolled.some((item) => item.includes('第二节'))).toBe(true)
    await click(container, '源码')
    expect(sourceField(container).value).toBe(essayFixture)
    expect(sourceField(container).selectionStart).toBe(caret)
    expect(sourceField(container).scrollTop).toBeGreaterThan(0)
    expect(saved).toEqual([])
  })

  it('saves after typing and still accepts input while a save is in flight', async () => {
    const texts: string[] = []
    const pending: ((ok: boolean) => void)[] = []
    const { container } = await render(
      bridge(
        (text) =>
          new Promise((resolve) => {
            texts.push(text)
            pending.push((ok) => resolve(ok))
          })
      )
    )
    await click(container, '源码')
    const field = sourceField(container)
    await type(field, field.value.replace('苹果', '梨'))
    await flush()
    expect(text(container, '.essay-status')).toBe('保存中')
    expect(field.disabled).toBe(false)
    await type(field, field.value.replace('梨', '桃'))
    expect(field.value).toContain('桃')
    await settle(pending)
    expect(text(container, '.essay-status')).toBe('已保存')
    expect(texts.at(-1)).toContain('桃')
    expect(texts.at(-1)).not.toContain('苹果')
  })

  it('waits until composition ends before saving the composed text', async () => {
    const saved: string[] = []
    const { container } = await render(bridge(async (text) => {
      saved.push(text)
      return true
    }))
    await click(container, '源码')
    const field = sourceField(container)
    await act(async () => {
      field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    })
    await type(field, `${field.value.slice(0, -1)}中\n`)
    await flush()
    expect(saved).toEqual([])
    expect(field.value).toContain('中')
    await act(async () => {
      field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中' }))
    })
    await flush()
    expect(saved).toEqual([field.value])
    expect(saved[0]).toContain('中')
  })

  it('checks a task in reading mode and writes the mark back', async () => {
    const saved: string[] = []
    const { container } = await render(bridge(async (text) => {
      saved.push(text)
      return true
    }))
    const box = container.querySelector('input[type="checkbox"]')
    if (!(box instanceof HTMLInputElement)) throw new Error('没有任务项')
    expect(box.checked).toBe(false)
    expect(container.querySelector('.essay-page')?.getAttribute('data-mode')).toBe('reading')
    await act(async () => {
      box.click()
    })
    await flush()
    expect(box.checked).toBe(true)
    expect(saved.at(-1)).toContain('- [x] 未做')
  })

  it('keeps the caret on the same list item across modes', async () => {
    const { container } = await render(bridge(async () => true))
    await click(container, '源码')
    const field = sourceField(container)
    const banana = field.value.indexOf('- 香蕉')
    field.setSelectionRange(banana + 3, banana + 3)
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
    expect(scrolled.some((item) => item.includes('香蕉'))).toBe(true)
    await click(container, '源码')
    const next = sourceField(container)
    const line = next.value.slice(0, next.selectionStart).split('\n').length - 1
    expect(next.value.split('\n')[line]).toBe('- 香蕉')
  })

  it('draws a proposed diff on the essay page and keeps the original text when it is discarded', async () => {
    const applied: (string | undefined)[] = []
    let discarded = false
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(
        <EssayPage
          path="阅读.md"
          body={essayFixture}
          bridge={bridge(async () => true)}
          saveDelay={0}
          proposal={{
            id: 'd1',
            path: '阅读.md',
            type: 'essay',
            groups: [{ id: 'g1', unit: 'paragraph', before: '选区里的句子', after: '短句' }],
            conversion: null
          }}
          onApply={(groupId) => {
            applied.push(groupId)
          }}
          onDiscard={() => {
            discarded = true
          }}
        />
      )
    })
    const card = container.querySelector('.essay-page .diff-card')
    expect(card?.textContent).toContain('选区里的句子')
    expect(card?.textContent).toContain('短句')
    await click(container, '接受')
    expect(applied).toEqual(['g1'])
    await click(container, '放弃')
    expect(discarded).toBe(true)
    await click(container, '源码')
    expect(sourceField(container).value).toBe(essayFixture)
  })
})

async function render(bridgeImpl: KeepNoteBridge): Promise<{ container: HTMLDivElement }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<EssayPage path="阅读.md" body={essayFixture} bridge={bridgeImpl} saveDelay={0} />)
  })
  return { container }
}

function bridge(save: (text: string) => Promise<boolean> | boolean): KeepNoteBridge {
  return {
    async run(command, args) {
      if (command !== 'save' || args?.text === undefined) {
        return { ok: false, code: 'missing-text', message: '缺少要保存的正文' }
      }
      const ok = await save(args.text)
      return ok
        ? { ok: true, value: { path: args.path ?? '', title: '阅读', created: false, message: '已保存' } }
        : { ok: false, code: 'write-failed', message: '写不了' }
    },
    async query() {
      return { ok: true, value: null }
    },
    subscribe() {
      return () => undefined
    }
  }
}

async function click(container: ParentNode, name: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === name)
  if (!button) throw new Error(`没有${name}`)
  await act(async () => {
    button.click()
  })
}

async function type(field: HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function settle(pending: ((ok: boolean) => void)[]): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await flush()
    const waiting = pending.splice(0)
    if (waiting.length === 0) return
    await act(async () => {
      for (const resolve of waiting) resolve(true)
    })
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function sourceField(container: ParentNode): HTMLTextAreaElement {
  const field = container.querySelector('textarea')
  if (!(field instanceof HTMLTextAreaElement)) throw new Error('没有源码')
  return field
}

function text(container: ParentNode, selector: string): string {
  return container.querySelector(selector)?.textContent ?? ''
}
