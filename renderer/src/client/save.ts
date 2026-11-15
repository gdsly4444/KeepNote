import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeepNoteBridge } from '../../../shared'

export function useNoteSave(bridge: KeepNoteBridge, path: string, initial: string, delay = 400) {
  const bridgeRef = useRef(bridge)
  const pathRef = useRef(path)
  const acked = useRef(initial)
  const pending = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composing = useRef(false)
  const retries = useRef(0)
  const [status, setStatus] = useState<'已保存' | '保存中'>('已保存')
  bridgeRef.current = bridge
  pathRef.current = path

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const schedule = useCallback((text: string) => {
    pending.current = text
    if (composing.current || text === acked.current) {
      if (!composing.current && text === acked.current) setStatus('已保存')
      if (composing.current && text !== acked.current) setStatus('保存中')
      return
    }
    setStatus('保存中')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void persist(), delay)
  }, [delay])

  async function persist(): Promise<void> {
    const text = pending.current
    if (text === acked.current) {
      setStatus('已保存')
      return
    }
    let ok = false
    try {
      const result = await bridgeRef.current.run('save', { path: pathRef.current, text })
      ok = result.ok
    } catch {
      ok = false
    }
    if (pending.current !== text) {
      schedule(pending.current)
      return
    }
    if (!ok) {
      if (retries.current < 1) {
        retries.current += 1
        timer.current = setTimeout(() => void persist(), 1000)
      }
      return
    }
    retries.current = 0
    acked.current = text
    setStatus('已保存')
  }

  const setComposing = useCallback((value: boolean) => {
    composing.current = value
    if (!value) schedule(pending.current)
  }, [schedule])

  return { status, schedule, setComposing }
}
