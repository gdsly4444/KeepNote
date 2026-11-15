export function appendJournalEntry(source: string, time: string, text: string): string {
  const lines = source.replace(/\n+$/, '').split('\n')
  let heading = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.startsWith('## ')) heading = index
  }
  const entry = [`## ${time}`, '', text]
  if (heading >= 0 && lines.slice(heading + 1).every((line) => line.trim() === '')) {
    return finish([...lines.slice(0, heading), ...entry])
  }
  return finish([...lines, '', ...entry])
}

export function clockTime(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function finish(lines: readonly string[]): string {
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}
