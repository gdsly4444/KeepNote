import type { KeepNoteBridge, LibraryStatus } from '../../../shared'

export async function loadLibrary(bridge: KeepNoteBridge): Promise<LibraryStatus> {
  try {
    const result = await bridge.query('library')
    if (!result.ok) return { state: 'failed', message: result.message }
    if (!result.value || !('state' in result.value)) return { state: 'closed' }
    return result.value
  } catch {
    return { state: 'failed', message: '库没有读成' }
  }
}

export async function openLibrary(bridge: KeepNoteBridge): Promise<LibraryStatus> {
  try {
    const opened = await bridge.run('open-library')
    if (!opened.ok) return { state: 'failed', message: opened.message }
    return loadLibrary(bridge)
  } catch {
    return { state: 'failed', message: '库没有读成' }
  }
}
