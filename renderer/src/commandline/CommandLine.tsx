import { useEffect, useState, type KeyboardEvent, type Ref } from 'react'
import type { BridgeResult, CommandName, CommandSuccess, CompletionItem, KeepNoteBridge, QueryValue } from '../../../shared'
import './commandline.css'
import { readCommandLine } from './read'

export function CommandLine({
  bridge,
  currentPath,
  value,
  onChange,
  onResult,
  fieldRef,
  notice = ''
}: {
  bridge: KeepNoteBridge
  currentPath?: string
  value: string
  onChange: (value: string) => void
  onResult: (command: CommandName, result: BridgeResult<CommandSuccess | null>) => void
  fieldRef?: Ref<HTMLInputElement>
  notice?: string
}) {
  const [echo, setEcho] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [place, setPlace] = useState(-1)
  const [items, setItems] = useState<CompletionItem[]>([])
  const [active, setActive] = useState(-1)

  useEffect(() => {
    setActive(-1)
    let cancel = false
    if (!value.trim()) {
      setItems([])
      return () => {
        cancel = true
      }
    }
    void bridge.query('complete', { text: value }).then((result) => {
      if (!cancel) setItems(completionItems(result.ok ? result.value : null))
    }, () => {
      if (!cancel) setItems([])
    })
    return () => {
      cancel = true
    }
  }, [bridge, value])

  async function submit(line: string): Promise<void> {
    const read = readCommandLine(line)
    if (!read) {
      if (agentSpeech(line)) {
        const result = await bridge.run('ask', currentPath ? { text: line.trim(), currentPath } : { text: line.trim() })
        setEcho(result.ok ? (result.value?.message ?? '') : result.message)
        if (result.ok) onChange('')
        onResult('ask', result)
        return
      }
      if (line.trim()) setEcho('未知命令')
      return
    }
    const args = currentPath ? { ...read.args, currentPath } : read.args
    const result = await bridge.run(read.command, args)
    setEcho(result.ok ? (result.value?.message ?? '') : result.message)
    setHistory((lines) => [line, ...lines.filter((item) => item !== line)])
    setPlace(-1)
    if (result.ok) onChange('')
    onResult(read.command, result)
  }

  function choose(next: string): void {
    setActive(-1)
    onChange(next)
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault()
      setActive((current) => (current + 1) % items.length)
      return
    }
    if (event.key === 'Tab' && items.length > 0) {
      event.preventDefault()
      const chosen = items[active] ?? items[0]
      if (chosen) choose(chosen.value)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = active >= 0 ? items[active] : undefined
      if (chosen) {
        choose(chosen.value)
        return
      }
      void submit(value)
      return
    }
    if (event.key === 'ArrowUp' && active >= 0) {
      event.preventDefault()
      setActive((current) => (current - 1 + items.length) % items.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.min(place + 1, history.length - 1)
      const line = history[next]
      if (line === undefined) return
      setPlace(next)
      onChange(line)
    }
  }

  return (
    <div className="command-bar">
      <div className="command-pop">
        <ul className="command-complete" aria-label="补全">
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.label}-${index}`}>
              <button
                className="command-choice"
                type="button"
                data-active={index === active ? 'true' : 'false'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item.value)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        {notice || echo ? (
          <p className="command-echo" role="status">
            {notice || echo}
          </p>
        ) : null}
      </div>
      <div className="command-line">
        <span className="command-prompt" aria-hidden="true">
          ›
        </span>
        <input
          ref={fieldRef}
          aria-label="命令行"
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKey}
        />
      </div>
    </div>
  )
}

function agentSpeech(line: string): boolean {
  const text = line.trim()
  return text.length > 0 && /[^\u0000-\u007f]/.test(text)
}

function completionItems(value: QueryValue): CompletionItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item.kind === 'command' || item.kind === 'type' || item.kind === 'note')
}
