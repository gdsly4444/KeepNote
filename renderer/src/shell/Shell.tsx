import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { CommandName, DeskView, DocumentType, KeepNoteBridge, LibraryStatus, MarkdownDocument } from '../../../shared'
import { getKeepNote } from '../client'
import { CommandLine } from '../commandline'
import { EssayPage } from '../essay'
import { JournalPage } from '../journal'
import { LibraryView, loadLibrary, openLibrary } from '../library'
import { ListPage } from '../list'
import { ContextSide, NavSide, contextEmpty, contextItems, typeName, type ContextItem } from '../sidebar'
import { TechPage, codeBlocks } from '../tech'
import { WorkPage } from '../work'
import { fitSides, sideWidth } from './layout'
import { chooseOpening } from './opening'
import './shell.css'

interface PageScroll {
  kind: 'heading' | 'code'
  text: string
  index: number
  line: number
  nonce: number
}

const opensDocument = new Set<CommandName>(['today', 'diary', 'new', 'open'])

export function Shell() {
  const [status, setStatus] = useState<LibraryStatus>({ state: 'closed' })
  const [libraryToken, setLibraryToken] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [line, setLine] = useState('')
  const [notice, setNotice] = useState('')
  const [focus, setFocus] = useState(false)
  const [commandVisible, setCommandVisible] = useState(true)
  const [navOpen, setNavOpen] = useState(true)
  const [contextOpen, setContextOpen] = useState(true)
  const [navWidth, setNavWidth] = useState(220)
  const [contextWidth, setContextWidth] = useState(240)
  const [dragging, setDragging] = useState(false)
  const [deskName, setDeskName] = useState('库')
  const [scrollTo, setScrollTo] = useState<PageScroll | null>(null)
  const commandRef = useRef<HTMLInputElement>(null)
  const nonce = useRef(0)
  const visit = useRef(0)
  const chosen = useRef<string | null>(null)
  const frame = useRef({ navWidth: 220, contextWidth: 240, navOpen: true, contextOpen: true })
  const statusRef = useRef(status)
  statusRef.current = status
  frame.current = { navWidth, contextWidth, navOpen, contextOpen }

  useEffect(() => {
    const keepNote = getKeepNote()
    if (!keepNote) {
      setStatus({ state: 'failed', message: '逻辑进程没有接通' })
      return
    }
    let cancelled = false
    const apply = (next: LibraryStatus): void => {
      if (!cancelled) setStatus(next)
    }
    void loadLibrary(keepNote).then(apply, () => apply({ state: 'failed', message: '库没有读成' }))
    const unsubscribe = keepNote.subscribe('library-changed', () => {
      void loadLibrary(keepNote).then(apply, () => apply({ state: 'failed', message: '库没有读成' }))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (status.state !== 'ready' && status.state !== 'empty') return
    const token = visit.current
    let cancel = false
    void (async () => {
      const bridge = getKeepNote()
      if (!bridge) return
      const desk = await loadDesk(bridge)
      if (cancel || visit.current !== token) return
      if (desk?.name) setDeskName(desk.name)
      const paths = statusRef.current.state === 'ready'
        ? statusRef.current.entries.flatMap((entry) => (entry.kind === 'markdown' ? [entry.path] : []))
        : []
      const choice = chooseOpening({ paths, desk })
      if (choice.action === 'restore') {
        chosen.current = choice.path
        setSelected(choice.path)
        return
      }
      const result = await bridge.run('today')
      if (cancel) return
      await settle(token, result)
    })()
    return () => {
      cancel = true
    }
  }, [status.state, libraryToken])

  useEffect(() => {
    const apply = (): void => {
      const fit = fitSides(
        window.innerWidth,
        frame.current.navWidth,
        frame.current.contextWidth,
        frame.current.navOpen,
        frame.current.contextOpen
      )
      setNavOpen(fit.navOpen)
      setContextOpen(fit.contextOpen)
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setCommandVisible(true)
      commandRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bridge = getKeepNote()
  const current = markdownDocument(status, selected)
  const blocks = current?.type === 'tech' ? codeBlocks(current.body) : []
  const items = current ? contextItems(current.type, current.outline, blocks) : []

  useEffect(() => {
    if (current?.type === 'journal') commandRef.current?.focus()
  }, [current?.path, current?.type])

  const openFolder = (): void => {
    const keepNote = getKeepNote()
    if (!keepNote) {
      setStatus({ state: 'failed', message: '逻辑进程没有接通' })
      return
    }
    hold(null)
    void openLibrary(keepNote).then((next) => {
      setStatus(next)
      setSelected(null)
      setLibraryToken((value) => value + 1)
    }, () => setStatus({ state: 'failed', message: '库没有读成' }))
  }

  function hold(path: string | null): number {
    visit.current += 1
    chosen.current = path
    return visit.current
  }

  async function settle(token: number, result: Awaited<ReturnType<KeepNoteBridge['run']>>): Promise<void> {
    if (visit.current !== token) {
      const kept = chosen.current
      if (kept) await getKeepNote()?.run('open', { path: kept })
      return
    }
    if (!result.ok || !result.value) {
      if (!result.ok) setNotice(result.message)
      return
    }
    chosen.current = result.value.path
    setNotice('')
    setSelected(result.value.path)
    setFocus(false)
    setCommandVisible(true)
  }

  async function show(path: string): Promise<void> {
    hold(path)
    setSelected(path)
    setFocus(false)
    setCommandVisible(true)
    const keepNote = getKeepNote()
    if (keepNote) await keepNote.run('open', { path })
  }

  async function runToday(): Promise<void> {
    const keepNote = getKeepNote()
    if (!keepNote) return
    const token = hold(null)
    const result = await keepNote.run('today')
    await settle(token, result)
  }

  function create(type: DocumentType): void {
    if (type === 'work') {
      void runToday()
      return
    }
    if (type === 'journal') {
      const keepNote = getKeepNote()
      if (!keepNote) return
      const token = hold(null)
      void keepNote.run('diary').then((result) => settle(token, result))
      setCommandVisible(true)
      return
    }
    setCommandVisible(true)
    setLine(`new ${type} `)
    commandRef.current?.focus()
  }

  function toggleFocus(): void {
    if (!current) return
    if (focus) {
      setFocus(false)
      setNavOpen(true)
      setContextOpen(true)
      setCommandVisible(true)
      return
    }
    setFocus(true)
    setNavOpen(false)
    setContextOpen(false)
    const keepCommand = current.type === 'work' || current.type === 'journal'
    setCommandVisible(keepCommand)
    if (keepCommand) commandRef.current?.focus()
  }

  function pick(item: ContextItem): void {
    nonce.current += 1
    setScrollTo({ kind: item.kind, text: item.text, index: item.index, line: item.line, nonce: nonce.current })
  }

  function beginDrag(side: 'nav' | 'context', event: ReactPointerEvent<HTMLButtonElement>): void {
    event.preventDefault()
    const startX = event.clientX
    const start = side === 'nav' ? navWidth : contextWidth
    const other = side === 'nav' ? (contextOpen ? contextWidth : 0) : navOpen ? navWidth : 0
    setDragging(true)
    const move = (ev: PointerEvent): void => {
      const delta = side === 'nav' ? ev.clientX - startX : startX - ev.clientX
      const next = sideWidth(start + delta, other, window.innerWidth)
      if (next === null) {
        if (side === 'nav') setNavOpen(false)
        else setContextOpen(false)
        return
      }
      if (side === 'nav') {
        setNavOpen(true)
        setNavWidth(next)
      } else {
        setContextOpen(true)
        setContextWidth(next)
      }
    }
    const stop = (): void => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const style = {
    '--shell-nav': navOpen ? `${navWidth}px` : '0px',
    '--shell-context': contextOpen ? `${contextWidth}px` : '0px'
  } as CSSProperties

  return (
    <div
      className="shell"
      data-focus={focus ? 'true' : 'false'}
      data-command={commandVisible ? 'shown' : 'hidden'}
      data-drag={dragging ? 'true' : 'false'}
      data-nav={navOpen ? 'open' : 'closed'}
      data-context={contextOpen ? 'open' : 'closed'}
      style={style}
    >
      <header className="shell-top">
        <button className="shell-library shell-fade" type="button" tabIndex={focus ? -1 : 0} onClick={() => { hold(null); setSelected(null) }}>
          {deskName || '库'}
        </button>
        <p className="shell-title">{current?.title ?? '未打开笔记'}</p>
        <p className="shell-type">{current ? typeName(current.type) : ''}</p>
        <button className="control" type="button" onClick={() => void runToday()}>
          今天
        </button>
        <input
          className="shell-search shell-fade"
          aria-label="搜索"
          tabIndex={focus ? -1 : 0}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="shell-text shell-fade" type="button" tabIndex={focus ? -1 : 0} onClick={() => setNavOpen((open) => !open)}>
          {navOpen ? '收起导航' : '导航'}
        </button>
        <button className="shell-text shell-fade" type="button" tabIndex={focus ? -1 : 0} onClick={() => setContextOpen((open) => !open)}>
          {contextOpen ? '收起上下文' : '上下文'}
        </button>
        {current ? (
          <button className="shell-text" type="button" onClick={toggleFocus}>
            {focus ? '完整' : '专注'}
          </button>
        ) : null}
        {commandVisible ? null : (
          <button
            className="shell-text shell-fade"
            type="button"
            tabIndex={focus ? -1 : 0}
            onClick={() => {
              setCommandVisible(true)
              commandRef.current?.focus()
            }}
          >
            命令行
          </button>
        )}
      </header>
      <aside className="shell-nav">
        <button className="shell-split" type="button" aria-label="拖动导航" onPointerDown={(event) => beginDrag('nav', event)} />
        {status.state === 'ready' ? (
          <NavSide
            entries={status.entries}
            currentType={current?.type ?? null}
            currentPath={current?.path ?? null}
            query={query}
            onOpen={(path) => void show(path)}
            onCreate={create}
          />
        ) : (
          <p className="side-empty">{status.state === 'closed' ? '还没有打开库' : status.state === 'empty' ? '库是空的' : status.state === 'failed' ? status.message : ''}</p>
        )}
      </aside>
      <main className="shell-page">
        {current && bridge ? (
          <DocumentPage
            document={current}
            bridge={bridge}
            scrollTo={scrollTo}
            onOpenTitle={(title) => {
              const path = pathForTitle(status, title)
              if (path) void show(path)
            }}
          />
        ) : (
          <LibraryView status={status} query={query} onOpen={openFolder} onSelect={(path) => void show(path)} />
        )}
      </main>
      <aside className="shell-context">
        <button className="shell-split shell-split-context" type="button" aria-label="拖动上下文" onPointerDown={(event) => beginDrag('context', event)} />
        {current ? <ContextSide items={items} empty={contextEmpty(current.type)} onPick={pick} /> : <p className="side-empty">还没有打开笔记</p>}
      </aside>
      {bridge ? (
        <div className="shell-command">
          <CommandLine
            bridge={bridge}
            currentPath={current?.path}
            value={line}
            onChange={setLine}
            notice={notice}
            fieldRef={commandRef}
            onResult={(command, result) => {
              setNotice('')
              if (result.ok && result.value && opensDocument.has(command)) {
                hold(result.value.path)
                setSelected(result.value.path)
                setFocus(false)
                setCommandVisible(true)
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function DocumentPage({
  document,
  bridge,
  scrollTo,
  onOpenTitle
}: {
  document: MarkdownDocument
  bridge: KeepNoteBridge
  scrollTo: PageScroll | null
  onOpenTitle: (title: string) => void
}) {
  const shared = { path: document.path, body: document.body, bridge }
  const heading = scrollTo ? { text: scrollTo.text, index: scrollTo.index, nonce: scrollTo.nonce } : null
  if (document.type === 'work') return <WorkPage {...shared} scrollTo={heading} onOpenTitle={onOpenTitle} />
  if (document.type === 'journal') return <JournalPage {...shared} scrollTo={heading} autofocus={false} />
  if (document.type === 'list') return <ListPage {...shared} scrollTo={heading} />
  if (document.type === 'tech') return <TechPage {...shared} scrollTo={scrollTo} />
  return <EssayPage {...shared} scrollTo={heading} />
}

function markdownDocument(status: LibraryStatus, path: string | null): MarkdownDocument | null {
  if (!path || status.state !== 'ready') return null
  const entry = status.entries.find((item) => item.path === path)
  if (!entry || entry.kind !== 'markdown') return null
  return entry
}

function pathForTitle(status: LibraryStatus, title: string): string | null {
  if (status.state !== 'ready') return null
  const matches = status.entries.filter((entry) => {
    if (entry.kind !== 'markdown') return false
    const stem = entry.name.replace(/\.md$/i, '')
    return entry.title === title || stem === title
  })
  return matches.length === 1 ? (matches[0]?.path ?? null) : null
}

async function loadDesk(bridge: KeepNoteBridge): Promise<DeskView | null> {
  const result = await bridge.query('desk')
  if (!result.ok || !result.value || !('today' in result.value) || 'state' in result.value) return null
  return result.value
}
