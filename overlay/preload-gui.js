const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('guiAPI', {
  setOpacity: (v) => ipcRenderer.invoke('minimap:opacity', v),
  setVisible: (on) => ipcRenderer.invoke('minimap:visible', on),
  resize: (delta) => ipcRenderer.invoke('minimap:resize', delta),
  setWidth: (w) => ipcRenderer.invoke('minimap:width', w),
  getWidth: () => ipcRenderer.invoke('minimap:getwidth'),
  setBg: (v) => ipcRenderer.invoke('minimap:bg', v),
  getManifest: () => ipcRenderer.invoke('gui:manifest'),
  getSettings: () => ipcRenderer.invoke('gui:settings'),
  setHotkey: (combo) => ipcRenderer.invoke('gui:sethotkey', combo),
  select: (sel) => ipcRenderer.invoke('gui:select', sel),
  updateStatus: () => ipcRenderer.invoke('gui:updatestatus'),
  checkNow: () => ipcRenderer.invoke('gui:checknow'),
  checkAppUpdate: () => ipcRenderer.invoke('gui:checkappupdate'),
  onAppUpdate: (cb) => ipcRenderer.on('gui:appupdate', (_e, s) => cb(s)),
  installUpdate: () => ipcRenderer.invoke('gui:installupdate'),
  minimize: () => ipcRenderer.invoke('gui:minimize'),
  resetPos: () => ipcRenderer.invoke('gui:resetpos'),
  quit: () => ipcRenderer.invoke('gui:quit'),
})
