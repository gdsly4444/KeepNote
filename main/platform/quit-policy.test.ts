import { describe, expect, it } from 'vitest'
import { quitsWhenLastWindowCloses } from './quit-policy'

describe('quitsWhenLastWindowCloses', () => {
  it('keeps the macOS process alive after the last window closes', () => {
    expect(quitsWhenLastWindowCloses('darwin')).toBe(false)
  })

  it('quits on Windows and Linux when the last window closes', () => {
    expect(quitsWhenLastWindowCloses('win32')).toBe(true)
    expect(quitsWhenLastWindowCloses('linux')).toBe(true)
  })
})
