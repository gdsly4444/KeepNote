import { useState, type KeyboardEvent, type Ref } from 'react'
import type { BridgeResult, CommandName, CommandSuccess, KeepNoteBridge } from '../../../shared'
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

  async function submit(line: string): Promise<void> {
    const read = readCommandLine(line)
    if (!read) {
      if (line.trim()) setEcho('未知命令')
      return
    }
    const args = currentPath ? { ...read.args, currentPath } : read.args
    const result = await bridge.run(read.command, args)
    setEcho(result.ok ? (result.value?.message ?? '') : result.message)
    setHistory((items) => [line, ...items.filter((item) => item !== line)])
    setPlace(-1)
    if (result.ok) onChange('')
    onResult(read.command, result)
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit(value)
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
        <ul className="command-complete" aria-label="补全" />
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
