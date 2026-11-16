// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { PageAgent } from './index'

const roots: Root[] = []

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('PageAgent', () => {
  it('asks from the selection toolbar and hides that toolbar on a list', async () => {
    const asked: string[] = []
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(
        <PageAgent
          type="essay"
          selection="选区里的句子"
          proposal={null}
          onApply={() => undefined}
          onDiscard={() => undefined}
          onAsk={(text) => {
            asked.push(text)
          }}
        />
      )
    })
    await click(container, '改写')
    expect(asked).toEqual(['改写：选区里的句子'])
    await act(async () => {
      root.render(
        <PageAgent
          type="list"
          selection="选区里的句子"
          proposal={null}
          onApply={() => undefined}
          onDiscard={() => undefined}
          onAsk={(text) => {
            asked.push(text)
          }}
        />
      )
    })
    expect(container.textContent).not.toContain('改写')
  })
})

async function click(container: ParentNode, name: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === name)
  if (!(button instanceof HTMLButtonElement)) throw new Error(`没有${name}`)
  await act(async () => {
    button.click()
  })
}
