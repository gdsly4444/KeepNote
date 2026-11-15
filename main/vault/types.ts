export interface ListedFile {
  path: string
  name: string
  markdown: boolean
  modifiedMs: number
}

export interface VaultDirectory {
  listFiles(root: string): Promise<ListedFile[]>
  readMarkdown(root: string, relativePath: string): Promise<string>
  watch(root: string, onChange: () => void): () => void
}

export interface VaultStore extends VaultDirectory {
  writeMarkdown(root: string, relativePath: string, text: string): Promise<void>
}

export function isMarkdownName(name: string): boolean {
  return name.toLowerCase().endsWith('.md')
}

export function isTemporaryName(name: string): boolean {
  return name.endsWith('.keepnote-tmp')
}
