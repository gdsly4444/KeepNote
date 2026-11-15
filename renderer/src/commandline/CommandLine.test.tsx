// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { CompletionItem, KeepNoteBridge } from '../../../shared'
import { CommandLine } from './index'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('CommandLine', () => {
  it('shows local completions above the input and inserts the chosen one', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    let line = ''
    const bridge = fake(async (_name, args) => {
      if (args?.text === '登') {
        return [{ kind: 'note', label: '登录跳转', value: 'open 登录跳转' }]
      }
      return []
    })
    await act(async () => {
      root.render(<CommandLine bridge={bridge} value={line} onChange={(next) => { line = next }} onResult={() => undefined} />)
    })
    const field = container.querySelector('[aria-label="命令行"]')
    if (!(field instanceof HTMLInputElement)) throw new Error('没有命令行')
    await act(async () => {
      root.render(<CommandLine bridge={bridge} value="登" onChange={(next) => { line = next }} onResult={() => undefined} />)
      await Promise.resolve()
    })
    const list = container.querySelector('.command-complete')
    expect(list?.parentElement?.className).toBe('command-pop')
    expect(list?.textContent).toContain('登录跳转')
    const choice = [...container.querySelectorAll('button')].find((item) => item.textContent === '登录跳转')
    if (!(choice instanceof HTMLButtonElement)) throw new Error('没有补全')
    await act(async () => {
      choice.click()
    })
    expect(line).toBe('open 登录跳转')
  })
})

function fake(complete: (name: string, args?: { text?: string }) => Promise<CompletionItem[]>): KeepNoteBridge {
  return {
    async run() {
      return { ok: true, value: null }
    },
    async query(name, args) {
      if (name !== 'complete') return { ok: true, value: null }
      return { ok: true, value: await complete(name, args) }
    },
    subscribe() {
      return () => undefined
    }
  }
}
