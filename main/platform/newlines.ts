export function normalizeNewlines(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  return withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}
