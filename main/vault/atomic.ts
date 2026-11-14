import { normalizeNewlines } from '../platform'

export interface AtomicIO {
  writeFile(path: string, text: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
}

export function temporaryPath(target: string): string {
  return `${target}.keepnote-tmp`
}

export async function writeAtomic(target: string, text: string, io: AtomicIO): Promise<void> {
  const temporary = temporaryPath(target)
  try {
    await io.writeFile(temporary, normalizeNewlines(text))
    await io.rename(temporary, target)
  } catch (error) {
    await io.remove(temporary).catch(() => undefined)
    throw error
  }
}
