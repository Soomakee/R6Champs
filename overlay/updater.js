/**
 * App self-update via GitHub Releases (electron-updater).
 * Checks on launch; auto-downloads in the background and prompts the GUI
 * when a new version is ready to install on quit. Map images update
 * separately and don't need any of this.
 */
const { autoUpdater } = require('electron-updater')

let broadcast = null // set by main.js

function initUpdater(onStatus) {
  broadcast = onStatus
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => send({ appUpdate: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    send({ appUpdate: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', () => send({ appUpdate: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ appUpdate: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    send({ appUpdate: 'ready', version: info.version })
  )
  autoUpdater.on('error', (err) => send({ appUpdate: 'error', error: String(err) }))

  return autoUpdater
}

function send(status) {
  if (broadcast) broadcast(status)
}

module.exports = { initUpdater, autoUpdater }
