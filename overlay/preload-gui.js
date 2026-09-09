const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('guiAPI', {
  setOpacity: (v) => ipcRenderer.invoke('minimap:opacity', v),
  setVisible: (on) => ipcRenderer.invoke('minimap:visible', on),
  resize: (delta) => ipcRenderer.invoke('minimap:resize', delta),
  setWidth: (w) => ipcRenderer.invoke('minimap:width', w),
  getWidth: () => ipcRenderer.invoke('minimap:getwidth'),
  setBg: (v) => ipcRenderer.invoke('minimap:bg', v),
  getManifest: () => ipcRenderer.invoke('gui:manifest'),
  select: (sel) => ipcRenderer.invoke('gui:select', sel),
  updateStatus: () => ipcRenderer.invoke('gui:updatestatus'),
  checkNow: () => ipcRenderer.invoke('gui:checknow'),
  onAppUpdate: (cb) => ipcRenderer.on('gui:appupdate', (_e, s) => cb(s)),
  installUpdate: () => ipcRenderer.invoke('gui:installupdate'),
  quit: () => ipcRenderer.invoke('gui:quit'),
})
