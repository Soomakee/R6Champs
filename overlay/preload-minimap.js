const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('minimapAPI', {
  close: () => ipcRenderer.invoke('gui:quit'),
  setMarker: (point) => ipcRenderer.invoke('minimap:setmarker', point),
  onSrc: (cb) => ipcRenderer.on('minimap:src', (_e, src) => cb(src)),
  onBg: (cb) => ipcRenderer.on('minimap:bg', (_e, v) => cb(v)),
  onMarker: (cb) => ipcRenderer.on('minimap:marker', (_e, m) => cb(m)),
})
