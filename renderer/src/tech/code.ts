export interface CodeBlock {
  language: string
  firstLine: string
  line: number
}

export function codeBlocks(source: string): CodeBlock[] {
  const lines = source.split('\n')
  const blocks: CodeBlock[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const open = /^(```+|~~~+)(.*)$/.exec(lines[index] ?? '')
    if (!open?.[1]) continue
    const mark = open[1][0] ?? '`'
    const size = open[1].length
    const language = (open[2] ?? '').trim().split(/\s+/)[0] ?? ''
    const body: string[] = []
    let cursor = index + 1
    for (; cursor < lines.length; cursor += 1) {
      if (closes(lines[cursor] ?? '', mark, size)) break
      body.push(lines[cursor] ?? '')
    }
    blocks.push({ language, firstLine: body[0] ?? '', line: index + 1 })
    index = cursor
  }
  return blocks
}

export function copiedCode(source: string, from: number, to: number): string | null {
  const selected = source.slice(from, to)
  if (!/(^|\n)\s*(```+|~~~+)/.test(selected)) return null
  const kept = selected
    .split('\n')
    .filter((line) => !/^\s*(```+|~~~+)/.test(line))
  return kept.join('\n').replace(/^\n+|\n+$/g, '')
}

function closes(line: string, mark: string, size: number): boolean {
  const match = new RegExp(`^(${mark}{${size},})\\s*$`).exec(line)
  return match !== null
}
