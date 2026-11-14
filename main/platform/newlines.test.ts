import { describe, expect, it } from 'vitest'
import { normalizeNewlines } from './newlines'

describe('normalizeNewlines', () => {
  it('turns CRLF and CR into LF and drops a leading BOM', () => {
    expect(normalizeNewlines('a\r\nb\rc')).toBe('a\nb\nc')
    expect(normalizeNewlines('\uFEFFkeep\n')).toBe('keep\n')
  })
})
