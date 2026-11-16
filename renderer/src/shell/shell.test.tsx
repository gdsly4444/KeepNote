// @vitest-environment happy-dom
import { EditorView } from '@codemirror/view'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentEvent, BridgeResult, CommandArgs, CommandName, CommandSuccess, KeepNoteBridge, LibraryStatus, MarkdownDocument } from '../../../shared'
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

describe('Shell', () => {
  it('keeps two logs on today while the tech note stays open', async () => {
    const calls: { command: CommandName; args?: CommandArgs }[] = []
    window.keepnote = bridge(library(), async (command, args) => {
      calls.push({ command, args })
      if (command === 'log') {
        return { ok: true, value: success('work/2026/11/2026-11-14.md', '10:12 已记入今天') }
      }
      if (command === 'today') return { ok: true, value: success('work/2026/11/2026-11-14.md', '今天的工作记录已经在了') }
      return { ok: false, code: 'unknown-command', message: '未知命令' }
    }, { today: '2026-11-14', day: '2026-11-14', name: '库', path: '命令.md' })
    const container = await render()
    expect(container.querySelector('.tech-page')).not.toBeNull()
    await submit(container, 'log 修了登录跳转')
    await submit(container, 'log 补了一处')
    expect(container.querySelector('.tech-page')).not.toBeNull()
    expect(container.querySelector('.work-page')).toBeNull()
    expect(calls.filter((call) => call.command === 'log').map((call) => call.args?.text)).toEqual(['修了登录跳转', '补了一处'])
    expect(calls.filter((call) => call.command === 'log').every((call) => call.args?.currentPath === '命令.md')).toBe(true)
    expect(container.querySelector('.command-echo')?.textContent).toBe('10:12 已记入今天')
    const field = container.querySelector('[aria-label="命令行"]')
    if (!(field instanceof HTMLInputElement)) throw new Error('没有命令行')
    expect(field.value).toBe('')
    await act(async () => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(calls.filter((call) => call.command === 'log')).toHaveLength(2)
    expect(container.querySelector('.command-echo')?.textContent).toBe('10:12 已记入今天')
    await click(container, '今天')
    expect(container.querySelector('.work-page')).not.toBeNull()
    expect(container.querySelector('.tech-page')).toBeNull()
  })

  it('keeps the note opened while today is still resolving', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const calls: { command: CommandName; args?: CommandArgs }[] = []
    window.keepnote = bridge(library(), async (command, args) => {
      calls.push({ command, args })
      if (command === 'today') {
        await gate
        return { ok: true, value: success('work/2026/11/2026-11-14.md', '今天的工作记录已经在了') }
      }
      if (command === 'open' && args?.path) return { ok: true, value: success(args.path, '打开了') }
      return { ok: true, value: null }
    })
    const container = await render()
    await click(container, '命令.md')
    expect(container.querySelector('.tech-page')).not.toBeNull()
    await act(async () => {
      release()
      await gate
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.tech-page')).not.toBeNull()
    expect(container.querySelector('.work-page')).toBeNull()
    expect(calls.filter((call) => call.command === 'open').at(-1)?.args?.path).toBe('命令.md')
  })

  it('echoes an unknown command and leaves the completion list empty', async () => {
    const calls: CommandName[] = []
    window.keepnote = bridge(closedLibrary(), async (command) => {
      calls.push(command)
      return { ok: false, code: 'unknown-command', message: '未知命令' }
    })
    const container = await render()
    await submit(container, 'rm -rf /')
    expect(container.querySelector('.command-echo')?.textContent).toBe('未知命令')
    expect(container.querySelector<HTMLInputElement>('[aria-label="命令行"]')?.value).toBe('rm -rf /')
    expect(container.querySelector('.command-complete')?.children.length).toBe(0)
    expect(calls).toEqual([])
    expect(container.querySelector('.command-line input')?.className ?? '').toBe('')
  })

  it('scrolls to an outline heading and can return from focus', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    window.keepnote = bridge(essayLibrary(), async () => ({ ok: true, value: null }))
    const container = await render()
    await click(container, '决定.md')
    const scrolled: string[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.textContent ?? '')
    }
    try {
      await click(container, '决定')
      expect(scrolled.some((text) => text.includes('决定'))).toBe(true)
      await click(container, '背景')
      expect(scrolled.some((text) => text.includes('背景'))).toBe(true)
    } finally {
      Element.prototype.scrollIntoView = original
    }
    window.keepnote = bridge(library(), async () => ({ ok: true, value: null }), {
      today: '2026-11-14',
      day: '2026-11-14',
      name: '库',
      path: '命令.md'
    })
    const tech = await render()
    const host = tech.querySelector('.cm-editor')
    if (!(host instanceof HTMLElement)) throw new Error('没有源码')
    const view = EditorView.findFromDOM(host)
    if (!view) throw new Error('没有编辑器')
    let scrolledLine = false
    const dispatch = view.dispatch.bind(view)
    view.dispatch = ((...input: never[]) => {
      scrolledLine = true
      return (dispatch as (...args: never[]) => void)(...input)
    }) as EditorView['dispatch']
    await click(tech, 'sh ls')
    expect(scrolledLine).toBe(true)
    await click(container, '专注')
    expect(container.querySelector('.shell')?.getAttribute('data-command')).toBe('hidden')
    expect(container.querySelector('.shell')?.getAttribute('data-nav')).toBe('closed')
    expect(container.querySelector('[aria-label="搜索"]')?.getAttribute('tabindex')).toBe('-1')
    expect(button(container, '今天').tabIndex).toBe(0)
    await click(container, '完整')
    expect(container.querySelector('.shell')?.getAttribute('data-command')).toBe('shown')
    expect(container.querySelector('.shell')?.getAttribute('data-nav')).toBe('open')
  })

  it('opens today when nothing was left open, and keeps the command line for work and journal', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    const commands: CommandName[] = []
    window.keepnote = bridge(focusLibrary(), async (command, args) => {
      commands.push(command)
      if (command === 'today') return { ok: true, value: success('work/2026/11/2026-11-14.md', '今天的工作记录已经在了') }
      if (command === 'open' && args?.path) return { ok: true, value: success(args.path, '打开了') }
      return { ok: true, value: null }
    })
    const container = await render()
    expect(commands).toContain('today')
    expect(container.querySelector('.work-page')).not.toBeNull()
    await click(container, '专注')
    expect(container.querySelector('.shell')?.getAttribute('data-command')).toBe('shown')
    expect(container.querySelector('[aria-label="在做"]')).not.toBeNull()
    await click(container, '完整')
    await submit(container, 'open 日记.md')
    expect(container.querySelector('.journal-page')).not.toBeNull()
    await click(container, '专注')
    expect(container.querySelector('.shell')?.getAttribute('data-command')).toBe('shown')
    expect(document.activeElement).toBe(container.querySelector('[aria-label="命令行"]'))
  })

  it('says when a search matches nothing and lets a drag stop at the document floor', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    window.keepnote = bridge(essayLibrary(), async () => ({ ok: true, value: null }))
    const container = await render()
    const search = container.querySelector('[aria-label="搜索"]')
    if (!(search instanceof HTMLInputElement)) throw new Error('没有搜索')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(search, '没有这篇')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('没有相符的')
    expect(container.textContent).not.toContain('决定.md')
    const handle = container.querySelector('[aria-label="拖动导航"]')
    if (!(handle instanceof HTMLElement)) throw new Error('没有拖动手柄')
    await act(async () => {
      handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: 220, bubbles: true }))
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 520, bubbles: true }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    const width = container.querySelector('.shell')?.getAttribute('style') ?? ''
    expect(width).toContain('--shell-nav: 360px')
  })

  it('interrupts a sidebar toggle with the next click', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    window.keepnote = bridge(closedLibrary(), async () => ({ ok: true, value: null }))
    const container = await render()
    await click(container, '收起导航')
    await click(container, '导航')
    expect(container.querySelector('.shell')?.getAttribute('data-nav')).toBe('open')
  })

  it('shows an empty library and a failed command with the shared ink', async () => {
    window.keepnote = bridge({ state: 'empty' }, async () => ({ ok: false, code: 'library-closed', message: '还没有打开库' }))
    const container = await render()
    expect(container.textContent).toContain('库是空的')
    await submit(container, 'log 记一笔')
    expect(container.querySelector('.command-echo')?.textContent).toBe('还没有打开库')
  })

  it('walks focus from today through the command line', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    window.keepnote = bridge(library(), async () => ({ ok: true, value: null }), {
      today: '2026-11-14',
      day: '2026-11-14',
      name: '库',
      path: '命令.md'
    })
    const container = await render()
    const today = button(container, '今天')
    const file = button(container, '命令.md')
    const field = container.querySelector('[aria-label="命令行"]')
    if (!(field instanceof HTMLElement)) throw new Error('没有命令行')
    await act(async () => {
      today.focus()
    })
    expect(document.activeElement).toBe(today)
    await act(async () => {
      file.focus()
    })
    expect(document.activeElement).toBe(file)
    await act(async () => {
      field.focus()
    })
    expect(document.activeElement).toBe(field)
  })

  it('moves an accepted note from the pending list into the recorded list', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
    let changed = {
      pending: [{ path: '登录.md', title: '登录跳转', type: 'essay' as const }],
      accepted: [] as { path: string; title: string; type: 'essay' }[]
    }
    const calls: CommandName[] = []
    window.keepnote = {
      async run(command) {
        calls.push(command)
        if (command === 'today') return { ok: true, value: success('work/2026/11/2026-11-14.md', '今天的工作记录已经在了') }
        if (command === 'accept') {
          changed = { pending: [], accepted: [{ path: '登录.md', title: '登录跳转', type: 'essay' }] }
          return { ok: true, value: success('work/2026/11/2026-11-14.md', '记入了「登录跳转」') }
        }
        return { ok: true, value: null }
      },
      async query(name) {
        if (name === 'desk') return { ok: true, value: { today: '2026-11-14', day: '', name: '库', path: null } }
        if (name === 'changed') return { ok: true, value: changed }
        if (name === 'library') return { ok: true, value: focusLibrary() }
        return { ok: true, value: null }
      },
      subscribe() {
        return () => undefined
      }
    }
    const container = await render()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-changed="pending"]')?.textContent).toContain('登录跳转')
    await click(container, '登录跳转')
    expect(calls).toContain('accept')
    expect(container.querySelector('[data-changed="pending"]')?.textContent).not.toContain('登录跳转')
    expect(container.querySelector('[data-changed="accepted"]')?.textContent).toContain('登录跳转')
    expect(container.querySelector('.work-page')).not.toBeNull()
  })

  it('lists a file read this turn and sends natural language into the agent session', async () => {
    const calls: { command: CommandName; args?: CommandArgs }[] = []
    let agent: ((payload: AgentEvent | null) => void) | null = null
    window.keepnote = {
      async run(command, args) {
        calls.push({ command, args })
        if (command === 'open' && args?.path) return { ok: true, value: success(args.path, '打开了') }
        return { ok: true, value: success('', '好') }
      },
      async query(name) {
        if (name === 'desk') return { ok: true, value: { today: '2026-11-14', day: '2026-11-14', name: '库', path: '决定.md' } }
        if (name === 'library') return { ok: true, value: essayLibrary() }
        return { ok: true, value: null }
      },
      subscribe(event, listener) {
        if (event === 'agent') agent = listener
        return () => undefined
      }
    }
    const container = await render()
    expect(container.querySelector('.essay-page')).not.toBeNull()
    expect(container.querySelector('.agent-side')?.textContent).toContain('还没有读笔记')
    await act(async () => {
      agent?.({ kind: 'read', text: '', path: '决定.md', proposal: null, state: '' })
    })
    expect(container.querySelector('.agent-side')?.textContent).toContain('决定.md')
    await submit(container, '把这篇缩短')
    expect(calls.some((call) => call.command === 'ask' && call.args?.text === '把这篇缩短' && call.args.currentPath === '决定.md')).toBe(true)
    const before = calls.length
    await submit(container, 'rm -rf /')
    expect(calls).toHaveLength(before)
    expect(container.querySelector('.command-echo')?.textContent).toBe('未知命令')
  })
})

async function render(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<Shell />)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  return container
}

async function click(container: ParentNode, name: string): Promise<void> {
  await act(async () => button(container, name).click())
}

function button(container: ParentNode, name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((item) => item.textContent === name)
  if (!(found instanceof HTMLButtonElement)) throw new Error(`没有${name}`)
  return found
}

async function submit(container: ParentNode, line: string): Promise<void> {
  const field = container.querySelector('[aria-label="命令行"]')
  if (!(field instanceof HTMLInputElement)) throw new Error('没有命令行')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(field, line)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
}

function closedLibrary(): LibraryStatus {
  return { state: 'closed' }
}

function library(): LibraryStatus {
  return {
    state: 'ready',
    entries: [
      doc('tech', '命令.md', '命令', '# 命令\n\n```sh\nls\n```\n', [{ level: 1, text: '命令' }]),
      doc('work', 'work/2026/11/2026-11-14.md', '2026-11-14', '# 2026-11-14\n\n## 在做\n\n## 记录\n\n## 产出\n\n## 留下\n', [
        { level: 1, text: '2026-11-14' },
        { level: 2, text: '在做' }
      ])
    ]
  }
}

function focusLibrary(): LibraryStatus {
  return {
    state: 'ready',
    entries: [
      doc('work', 'work/2026/11/2026-11-14.md', '2026-11-14', '# 2026-11-14\n\n## 在做\n\n登录跳转\n\n## 记录\n\n## 产出\n\n## 留下\n', []),
      doc('journal', '日记.md', '2026-11-14', '# 2026-11-14\n\n## 09:10\n\n早上\n', [{ level: 2, text: '09:10' }])
    ]
  }
}

function essayLibrary(): LibraryStatus {
  return {
    state: 'ready',
    entries: [doc('essay', '决定.md', '决定', '# 决定\n\n## 背景\n\n一段\n', [{ level: 1, text: '决定' }, { level: 2, text: '背景' }])]
  }
}

function doc(type: MarkdownDocument['type'], path: string, title: string, body: string, outline: MarkdownDocument['outline']): MarkdownDocument {
  return { kind: 'markdown', path, name: path.split('/').pop() ?? path, type, typeSource: 'marked', title, body, outline }
}

function success(path: string, message: string): CommandSuccess {
  return { path, title: '', created: false, message }
}

function bridge(
  status: LibraryStatus,
  run: (command: CommandName, args?: CommandArgs) => Promise<BridgeResult<CommandSuccess | null>>,
  desk = { today: '2026-11-14', day: '', name: '库', path: null as string | null }
): KeepNoteBridge {
  return {
    run,
    async query(name) {
      if (name === 'desk') return { ok: true, value: desk }
      if (name === 'library') return { ok: true, value: status }
      return { ok: true, value: null }
    },
    subscribe() {
      return () => undefined
    }
  }
}
