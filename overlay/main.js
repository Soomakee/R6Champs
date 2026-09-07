const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const path = require('path')

const argUrl = process.argv.find((a) => a.startsWith('--url='))
const SITE_URL = argUrl ? argUrl.slice(6) : process.env.OVERLAY_URL || 'https://r6legends.com/?view=overlay'

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 180,
    minHeight: 140,
    frame: false,
    backgroundColor: '#09090c',
    alwaysOnTop: true,
    title: 'R6Legends Overlay',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Stick above fullscreen apps (e.g. Siege in borderless/windowed fullscreen)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadURL(SITE_URL)

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(() => {
  createWindow()

  // Ctrl+Shift+O toggles the pin from anywhere, even while the game is focused
  globalShortcut.register('Ctrl+Shift+O', () => {
    if (!win) return
    const pinned = win.isAlwaysOnTop()
    win.setAlwaysOnTop(!pinned, 'screen-saver')
  })

  // Ctrl+Shift+H hides/shows the overlay from anywhere
  globalShortcut.register('Ctrl+Shift+H', () => {
    if (!win) return
    if (win.isVisible()) win.hide()
    else win.show()
  })

  app.on('activate', () => {
    if (!win) createWindow()
  })
})

ipcMain.handle('overlay:close', () => app.quit())
ipcMain.handle('overlay:minimize', () => win?.minimize())
ipcMain.handle('overlay:opacity', (_e, value) => {
  if (win) win.setOpacity(Math.min(1, Math.max(0.2, Number(value) || 1)))
})
ipcMain.handle('overlay:pin', (_e, on) => {
  win?.setAlwaysOnTop(Boolean(on), 'screen-saver')
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  app.quit()
})
