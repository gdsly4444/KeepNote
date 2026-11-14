import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { CommandName, CommandResult, EventName, KeepNoteBridge, QueryName } from '../shared'

const bridge: KeepNoteBridge = {
  run(command: CommandName): Promise<CommandResult> {
    return ipcRenderer.invoke('keepnote:run', command)
  },
  query(name: QueryName): Promise<CommandResult> {
    return ipcRenderer.invoke('keepnote:query', name)
  },
  subscribe(event: EventName, listener: () => void): () => void {
    const channel = `keepnote:event:${event}`
    const wrapped = (_ipcEvent: IpcRendererEvent): void => {
      listener()
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('keepnote', bridge)
