export function applyGroups(source: string, groups: readonly { before: string; after: string }[]): string | null {
  let text = source
  for (const group of groups) {
    if (group.before === '') {
      const body = group.after.endsWith('\n') ? group.after : `${group.after}\n`
      text = text.trim() === '' ? body : `${text.replace(/\n*$/, '')}\n${body}`
      continue
    }
    const at = text.indexOf(group.before)
    if (at < 0) return null
    text = `${text.slice(0, at)}${group.after}${text.slice(at + group.before.length)}`
  }
  return text
}
