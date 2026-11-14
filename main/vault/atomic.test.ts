import { describe, expect, it } from 'vitest'
import { temporaryPath, writeAtomic, type AtomicIO } from './atomic'

describe('writeAtomic', () => {
  it('replaces the file with LF and leaves no temporary file', async () => {
    const files = new Map<string, string>([['note.md', 'old\n']])
    await writeAtomic('note.md', 'new\r\nline', memoryIO(files))
    expect(files.get('note.md')).toBe('new\nline')
    expect(files.has(temporaryPath('note.md'))).toBe(false)
  })

  it('keeps the original file when the write is interrupted', async () => {
    const files = new Map<string, string>([['note.md', 'old\n']])
    const io = memoryIO(files)
    io.writeFile = async (path, text) => {
      files.set(path, text.slice(0, 1))
      throw new Error('中断')
    }
    await expect(writeAtomic('note.md', 'partial', io)).rejects.toThrow('中断')
    expect(files.get('note.md')).toBe('old\n')
    expect(files.has(temporaryPath('note.md'))).toBe(false)
  })
})

function memoryIO(files: Map<string, string>): AtomicIO {
  return {
    async writeFile(path, text) {
      files.set(path, text)
    },
    async rename(from, to) {
      const text = files.get(from)
      if (text === undefined) throw new Error('缺少临时文件')
      files.set(to, text)
      files.delete(from)
    },
    async remove(path) {
      files.delete(path)
    }
  }
}
