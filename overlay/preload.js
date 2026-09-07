const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlayAPI', {
  close: () => ipcRenderer.invoke('overlay:close'),
  minimize: () => ipcRenderer.invoke('overlay:minimize'),
  setOpacity: (value) => ipcRenderer.invoke('overlay:opacity', value),
  setPin: (on) => ipcRenderer.invoke('overlay:pin', on),
})
