import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AgentEvent, CommandArgs, CommandName, EventName, KeepNoteBridge, QueryArgs, QueryName } from '../shared'

const bridge: KeepNoteBridge = {
  run(command: CommandName, args?: CommandArgs) {
    return ipcRenderer.invoke('keepnote:run', command, args)
  },
  query(name: QueryName, args?: QueryArgs) {
    return ipcRenderer.invoke('keepnote:query', name, args)
  },
  subscribe(event: EventName, listener: (payload: AgentEvent | null) => void): () => void {
    const channel = `keepnote:event:${event}`
    const wrapped = (_ipcEvent: IpcRendererEvent, payload?: AgentEvent): void => {
      listener(payload ?? null)
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('keepnote', bridge)
