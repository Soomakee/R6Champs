const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { initUpdater, autoUpdater } = require('./updater')

// Fully self-contained: both windows load local HTML files, overlay images
// are served from disk. No website involved.
// In the packaged exe, overlay images live in resources/overlays (bundled,
// read-only); downloaded updates go to the writable userData folder and are
// merged over the bundle. In dev, everything uses the repo assets folder.
const PACKAGED_OVERLAYS = app.isPackaged
  ? path.join(process.resourcesPath, 'overlays')
  : null
const UPDATES_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'overlays')
  : path.join(__dirname, '..', 'assets', 'Map Blueprints Overlays')
const OVERLAYS_DIR = UPDATES_DIR
const BUNDLED_OVERLAYS_DIR = PACKAGED_OVERLAYS || OVERLAYS_DIR
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i

// --- GitHub map auto-update -----------------------------------------------
// The exe ships with a snapshot of the overlays. On every launch (and every
// 30 min while running) it fetches the manifest from raw.githubusercontent.com
// and downloads any map images that are new or changed. Updates merge with —
// never delete — what's already on disk.
const REPO = 'Soomakee/R6Champs'
const BRANCH = 'main'
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`
const API_BASE = `https://api.github.com/repos/${REPO}`
const UPDATE_STATE_FILE = path.join(app ? app.getPath('userData') : __dirname, 'map-updates.json')
const SETTINGS_FILE = path.join(app ? app.getPath('userData') : __dirname, 'settings.json')
const GH_HEADERS = { 'User-Agent': 'R6Legends-Overlay', Accept: 'application/vnd.github+json' }

let lastUpdateCheck = { at: null, ok: null, added: 0, updated: 0, error: null }

// --- User settings (persisted to userData/settings.json) --------------------
const DEFAULT_SETTINGS = {
  toggleHotkey: 'Ctrl+Shift+H', // bindable key-combo that shows/hides the minimap
  minimapWidth: 460,
  background: 0.14,
  minimapX: null, // last overlay position (null = OS default on first launch)
  minimapY: null,
}
let settings = { ...DEFAULT_SETTINGS }

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
      settings = { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {}
}
function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true })
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  } catch {}
}
function setSetting(key, value) {
  settings[key] = value
  saveSettings()
}

// Load persisted settings early so window size / background / hotkey defaults
// reflect the user's last session before any window is created.
loadSettings()

// --- Single-instance lock ----------------------------------------------------
// Only allow one copy of the app. A second launch focuses the already-running
// windows instead of starting a competing instance (which would fight over
// settings.json, overlay files, and the global hotkey).
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// --- Crash logging -----------------------------------------------------------
// A silent main-process crash is the worst failure mode (the app just
// disappears). Log the error to userData/error.log and surface a dialog so it
// isn't a mystery for you or your friends.
function logCrash(kind, err) {
  try {
    const stamp = new Date().toISOString()
    const line = `${stamp} [${kind}] ${err && err.stack ? err.stack : err}\n`
    fs.appendFileSync(path.join(app.getPath('userData'), 'error.log'), line)
  } catch {}
}
process.on('uncaughtException', (err) => {
  logCrash('uncaughtException', err)
  try {
    dialog.showErrorBox('R6Legends Overlay', `Something went wrong.\nA log was saved to:\n${path.join(app.getPath('userData'), 'error.log')}`)
  } catch {}
})
process.on('unhandledRejection', (err) => {
  logCrash('unhandledRejection', err)
})

function ghFetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https://api.github.com') ? require('https') : require('https')
    const req = require('https').get(url, { headers: GH_HEADERS }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        res.resume()
        return resolve(ghFetch(res.headers.location))
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.setTimeout(20000, () => req.destroy(new Error('timeout')))
  })
}

function readUpdateState() {
  try {
    return JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, 'utf8'))
  } catch {
    return { head: null }
  }
}

function writeUpdateState(state) {
  try {
    fs.writeFileSync(UPDATE_STATE_FILE, JSON.stringify(state, null, 2))
  } catch {
    /* non-fatal */
  }
}

async function checkForMapUpdates() {
  const state = readUpdateState()
  let added = 0
  let updated = 0
  try {
    // 1. Latest commit sha on main
    const branchRes = await ghFetch(`${API_BASE}/branches/${BRANCH}`)
    if (branchRes.status !== 200) throw new Error(`GitHub API ${branchRes.status}`)
    const head = JSON.parse(branchRes.body.toString()).commit.sha
    if (!head || head === state.head) {
      lastUpdateCheck = { at: Date.now(), ok: true, added: 0, updated: 0, error: null, upToDate: true }
      return lastUpdateCheck
    }

    // 2. Get the file tree for that commit; find all overlay images
    const treeRes = await ghFetch(`${API_BASE}/git/trees/${head}?recursive=1`)
    if (treeRes.status !== 200) throw new Error(`GitHub API ${treeRes.status}`)
    const tree = JSON.parse(treeRes.body.toString()).tree || []
    const entries = tree.filter(
      (n) =>
        n.type === 'blob' &&
        n.path.startsWith('assets/Map Blueprints Overlays/') &&
        IMAGE_RE.test(n.path)
    )
    if (!entries.length) throw new Error('no overlay files found in repo tree')

    // 3. Download anything new or changed (content sha differs from what we recorded)
    // Files land directly in OVERLAYS_DIR (userData/overlays when packaged),
    // preserving the <Map>/<Floor>.png structure the scanner expects.
    const PREFIX = 'assets/Map Blueprints Overlays/'
    const known = state.files || {}
    for (const entry of entries) {
      const rel = entry.path.slice(PREFIX.length) // e.g. "Bank/Basement.png"
      const dest = path.join(OVERLAYS_DIR, rel)
      // Verify the disk file actually matches the git blob sha — the state
      // file alone can't be trusted (e.g. a post-download overwrite leaves a
      // stale record). Re-download on any mismatch.
      if (known[entry.path] === entry.sha && fs.existsSync(dest)) {
        try {
          const disk = fs.readFileSync(dest)
          const diskSha = crypto
            .createHash('sha1')
            .update(`blob ${disk.length}\u0000`)
            .update(disk)
            .digest('hex')
          if (diskSha === entry.sha) continue
        } catch {}
      }
      const raw = await ghFetch(`${RAW_BASE}/${encodeURI(entry.path)}`)
      if (raw.status !== 200) continue
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, raw.body)
      known[entry.path] = entry.sha
      added++
    }
    writeUpdateState({ head, files: known })
    lastUpdateCheck = { at: Date.now(), ok: true, added, updated: 0, error: null }
    if (added > 0) {
      broadcastUpdate()
      // Force the minimap to re-render its (now updated) image: the URL
      // carries a new ?v= mtime stamp, bypassing Chromium's image cache.
      const src = currentSrc()
      if (src && minimap) minimap.webContents.send('minimap:src', src)
    }
  } catch (err) {
    lastUpdateCheck = { at: Date.now(), ok: false, added, updated: 0, error: String(err.message || err) }
  }
  return lastUpdateCheck
}

function broadcastUpdate() {
  // Refresh the GUI manifest so new maps appear without a restart
  if (gui) {
    gui.webContents.send('gui:manifest', {
      manifest: scanOverlays(),
      map: currentMap,
      floor: currentFloor,
      width: minimap ? minimap.getSize()[0] : 460,
    })
  }
  if (minimap) {
    const src = currentSrc()
    if (src) minimap.webContents.send('minimap:src', src)
  }
}

let lastAppUpdateStatus = null

function broadcastAppUpdate(status) {
  lastAppUpdateStatus = status
  if (gui) gui.webContents.send('gui:appupdate', status)
}

/**
 * Scan overlay folders into a manifest keyed by map name. Each floor's src is
 * a file:// URL pointing at the actual image on disk (updates dir wins over
 * the bundled copy on name collisions).
 */
function scanOverlays() {
  const dirs = app.isPackaged ? [BUNDLED_OVERLAYS_DIR, OVERLAYS_DIR] : [OVERLAYS_DIR]
  const out = {}
  const seen = new Set()
  // iterate updates dir last so its entries overwrite bundled ones
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const floors = fs
        .readdirSync(path.join(dir, entry.name))
        .filter((f) => IMAGE_RE.test(f))
        .map((f) => ({
          name: f.replace(IMAGE_RE, ''),
          file: path.join(dir, entry.name, f),
        }))
      for (const floor of floors) {
        if (!out[entry.name]) out[entry.name] = []
        const key = entry.name + '/' + floor.name
        // Cache-bust with mtime so an updated file (same path) re-renders
        let src = 'file:///' + floor.file.replace(/\\/g, '/')
        try {
          src += '?v=' + fs.statSync(floor.file).mtimeMs
        } catch {}
        const existing = out[entry.name].find((x) => x.name === floor.name)
        if (existing) existing.src = src
        else out[entry.name].push({ name: floor.name, src })
        seen.add(key)
      }
    }
  }
  for (const k of Object.keys(out)) {
    // Sort floors top-down (Top Floor → Ground Floor → Basement) to match a
    // building's physical layout. Falls back to numeric/alphabetical order.
    out[k].sort((a, b) => floorRank(b.name) - floorRank(a.name))
  }
  return out
}

// Higher number = physically higher floor.
function floorRank(name) {
  const s = name.toLowerCase()
  if (s.includes('roof')) return 120
  if (s.includes('penthouse')) return 110
  if (s.includes('top')) return 100
  if (s.includes('third') || s.includes('3rd')) return 90
  if (s.includes('second') || s.includes('2nd') || s.includes('middle')) return 80
  if (s.includes('first') || s.includes('1st') || s.includes('ground')) return 70
  const m = s.match(/(\d+)/)
  if (m) return 60 + Math.min(40, Number(m[1]))
  if (s.includes('basement') || s.includes('lower') || s.includes('sub')) return 10
  return 50
}

// Current selection (map name, floor index) shared between the GUI and minimap
let currentMap = process.env.MINIMAP_MAP || 'Calypso Casino'
let currentFloor = 0
let currentBg = settings.background // background wash opacity (0 = none)

let minimap = null
let gui = null

// App icon used for the windows' taskbar/alt-tab entries.
// In packaged builds electron-builder puts icon.png next to the exe's
// resources; in dev it sits alongside main.js.
const APP_ICON = path.join(__dirname, 'icon.png')

function currentSrc() {
  const manifest = scanOverlays()
  const floors = manifest[currentMap] || []
  const floor = floors[Math.min(currentFloor, floors.length - 1)]
  return floor ? floor.src : null
}

function createMinimap() {
  minimap = new BrowserWindow({
    width: settings.minimapWidth,
    height: Math.round(settings.minimapWidth * 0.75),
    minWidth: 120,
    minHeight: 90,
    frame: false,
    resizable: false,
    transparent: true,
    hasShadow: false,
    // NOTE: no backgroundColor here — setting any background color (even
    // '#00000000') makes transparent windows render solid black on Windows.
    alwaysOnTop: true,
    icon: APP_ICON,
    title: 'Minimap',
    webPreferences: {
      preload: path.join(__dirname, 'preload-minimap.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  minimap.setAlwaysOnTop(true, 'screen-saver')
  restoreMinimapPosition()
  // Remember where the user parked the overlay so it survives restarts.
  let posTimer = null
  minimap.on('move', () => {
    clearTimeout(posTimer)
    posTimer = setTimeout(() => {
      if (!minimap) return
      const [x, y] = minimap.getPosition()
      setSetting('minimapX', x)
      setSetting('minimapY', y)
    }, 250)
  })
  minimap.loadFile(path.join(__dirname, 'minimap.html'))
  // Hand the page its image (and any later changes) once it's up
  minimap.webContents.on('did-finish-load', () => {
    const src = currentSrc()
    if (src) minimap.webContents.send('minimap:src', src)
    minimap.webContents.send('minimap:bg', currentBg)
  })
  minimap.on('closed', () => (minimap = null))
}

// Move the overlay to a saved position if one exists, clamped so it's always
// fully (or at least mostly) visible on some display — a saved position can
// become invalid if a monitor is unplugged or resolution changes.
function restoreMinimapPosition() {
  if (!minimap) return
  const { minimapX, minimapY } = settings
  if (typeof minimapX === 'number' && typeof minimapY === 'number') {
    const [w, h] = minimap.getSize()
    const visible = require('electron').screen
      .getAllDisplays()
      .find((d) => {
        const { x, y, width, height } = d.workArea
        return (
          minimapX < x + width - 40 &&
          minimapX + w > x + 40 &&
          minimapY < y + height - 40 &&
          minimapY + h > y + 40
        )
      })
    if (visible) minimap.setPosition(minimapX, minimapY)
  }
}

// Reset the overlay to a centered position on the primary display (or the
// display the overlay is currently nearest to), in case it ever gets lost
// off-screen.
function resetMinimapPosition() {
  if (!minimap) return
  const { screen } = require('electron')
  const cur = screen.getDisplayMatching(minimap.getBounds())
  const { x, y, width, height } = cur.workArea
  const [w, h] = minimap.getSize()
  minimap.setPosition(Math.round(x + (width - w) / 2), Math.round(y + (height - h) / 2))
  const [nx, ny] = minimap.getPosition()
  setSetting('minimapX', nx)
  setSetting('minimapY', ny)
}

function createGui() {
  gui = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    icon: APP_ICON,
    resizable: false,
    title: 'Minimap Controls',
    webPreferences: {
      preload: path.join(__dirname, 'preload-gui.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  gui.setAlwaysOnTop(true, 'screen-saver')
  gui.loadFile(path.join(__dirname, 'gui.html'))
  // Give the GUI the overlays manifest + current selection once it's up
  gui.webContents.on('did-finish-load', () => {
    gui.webContents.send('gui:manifest', {
      manifest: scanOverlays(),
      map: currentMap,
      floor: currentFloor,
      width: minimap ? minimap.getSize()[0] : 460,
      version: app.getVersion(),
    })
    // The updater usually fires before this window finishes loading — replay
    // the last status so the GUI shows the true current update state.
    if (lastAppUpdateStatus) {
      setTimeout(() => gui && gui.webContents.send('gui:appupdate', lastAppUpdateStatus), 150)
    }
  })
  gui.on('closed', () => (gui = null))
}

app.whenReady().then(() => {
  if (!gotTheLock) return // a second instance already owns the app

  // If the user launches the app again while it's already running, focus
  // the existing windows rather than starting a duplicate.
  app.on('second-instance', () => {
    if (gui) {
      if (gui.isMinimized()) gui.restore()
      gui.show()
      gui.focus()
    }
    if (minimap) minimap.show()
  })

  // One-time repair for the early buggy build: it downloaded overlays into
  // userData/Map Blueprints Overlays (via a '..' path join) instead of
  // userData/overlays. Migrate anything NOT already present (never clobber
  // newer downloaded files), then remove the stray dir.
  try {
    const stray = path.join(app.getPath('userData'), 'Map Blueprints Overlays')
    if (fs.existsSync(stray)) {
      for (const map of fs.readdirSync(stray)) {
        const srcMap = path.join(stray, map)
        if (!fs.statSync(srcMap).isDirectory()) continue
        for (const f of fs.readdirSync(srcMap)) {
          const dest = path.join(OVERLAYS_DIR, map, f)
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(path.dirname(dest), { recursive: true })
            fs.copyFileSync(path.join(srcMap, f), dest)
          }
        }
      }
      fs.rmSync(stray, { recursive: true, force: true })
    }
    fs.rmSync(path.join(app.getPath('userData'), 'assets'), { recursive: true, force: true })
  } catch {}

  createMinimap()
  createGui()

  // Bindable hotkey hides/shows the minimap from anywhere (e.g. in-game).
  registerToggleHotkey()
  // Ctrl+Shift+O pins/unpins (always-on-top toggle)
  globalShortcut.register('Ctrl+Shift+O', () => {
    if (!minimap) return
    const pinned = minimap.isAlwaysOnTop()
    minimap.setAlwaysOnTop(!pinned, 'screen-saver')
  })

  // App self-update wiring (only meaningful when packaged; skipped in dev).
  // Updates are checked ONLY when the user clicks "Check for app update" —
  // never automatically on launch.
  if (app.isPackaged) {
    initUpdater(broadcastAppUpdate)
  }
})

// Smoothly fade the overlay in/out. show()/hide() alone is an instant cut that
// looks flashy/stuttery, so we animate window opacity instead.
let fadeTimer = null
function fadeMinimap(show) {
  if (!minimap) return
  clearTimeout(fadeTimer)
  if (show) minimap.show()
  const steps = 10
  const from = show ? 0 : minimap.getOpacity()
  const to = show ? 1 : 0
  const step = (to - from) / steps
  let i = 0
  const tick = () => {
    if (!minimap) return
    i++
    const v = Math.min(1, Math.max(0, from + step * i))
    minimap.setOpacity(v)
    if (i < steps) {
      fadeTimer = setTimeout(tick, 12)
    } else if (!show) {
      minimap.hide() // fully hidden only after the fade-out finishes
    }
  }
  tick()
}

function toggleMinimap() {
  if (!minimap) return
  fadeMinimap(!minimap.isVisible())
}

// Register (or re-register) the user's bindable show/hide hotkey.
function registerToggleHotkey() {
  globalShortcut.unregister(settings.toggleHotkey)
  if (settings.toggleHotkey) {
    globalShortcut.register(settings.toggleHotkey, toggleMinimap)
  }
}

// Validate/translate a user-typed combo into an Electron accelerator string,
// or return null if it can't be registered (e.g. a bare modifier or a letter
// already bound).
function normalizeAccelerator(raw) {
  const s = (raw || '').trim()
  if (!s) return null
  // Accept "h", "Ctrl+H", "Shift+Alt+1", etc. Electron uses + as the joiner.
  return s.replace(/\s+/g, '')
}

// --- IPC from the GUI window ---
ipcMain.handle('minimap:opacity', (_e, v) => {
  if (minimap) minimap.setOpacity(Math.min(1, Math.max(0, Number(v) || 0)))
})
ipcMain.handle('minimap:visible', (_e, on) => {
  if (!minimap) return
  fadeMinimap(!!on)
})
ipcMain.handle('minimap:resize', (_e, delta) => {
  if (!minimap) return
  const [w, h] = minimap.getSize()
  const d = Number(delta) || 0
  const scale = (w + d) / w
  minimap.setSize(Math.max(120, Math.round(w + d)), Math.max(90, Math.round(h * scale)))
})
// Set the minimap width directly; height keeps the 4:3 aspect of the default
ipcMain.handle('minimap:width', (_e, w) => {
  if (!minimap) return
  const width = Math.min(2000, Math.max(120, Math.round(Number(w) || 460)))
  // resizable:false blocks programmatic SHRINKING of a frameless window on
  // Windows (growing works, shrinking is ignored). Toggle resizable around
  // setSize so both directions work, then lock it back to prevent edge grabs.
  minimap.setResizable(true)
  minimap.setSize(width, Math.round(width * 0.75))
  minimap.setResizable(false)
  setSetting('minimapWidth', width)
  return width
})
ipcMain.handle('minimap:getwidth', () => {
  if (!minimap) return 460
  const [w] = minimap.getSize()
  return w
})
// Read the current settings for the GUI (hotkey, etc.).
ipcMain.handle('gui:settings', () => ({ ...settings }))
// Set the toggle-hotkey; re-registers it. Returns ok + the active combo.
ipcMain.handle('gui:sethotkey', (_e, combo) => {
  const accel = normalizeAccelerator(combo)
  if (!accel) return { ok: false, error: 'Invalid combo' }
  // Drop the old binding first so switching (e.g. Ctrl+H -> Alt+H) is clean.
  if (settings.toggleHotkey) globalShortcut.unregister(settings.toggleHotkey)
  try {
    const ok = globalShortcut.register(accel, toggleMinimap)
    if (!ok) {
      // Failed (e.g. bare letter on Windows). Restore the old binding.
      if (settings.toggleHotkey) globalShortcut.register(settings.toggleHotkey, toggleMinimap)
      return { ok: false, error: 'Combo unavailable' }
    }
  } catch {
    if (settings.toggleHotkey) globalShortcut.register(settings.toggleHotkey, toggleMinimap)
    return { ok: false, error: 'Invalid combo' }
  }
  setSetting('toggleHotkey', accel)
  return { ok: true, hotkey: accel }
})
ipcMain.handle('gui:manifest', () => ({
  manifest: scanOverlays(),
  map: currentMap,
  floor: currentFloor,
  width: minimap ? minimap.getSize()[0] : 460,
  version: app.getVersion(),
}))
ipcMain.handle('gui:select', (_e, { map, floor }) => {
  if (typeof map === 'string' && map) {
    currentMap = map
    currentFloor = 0
  }
  if (Number.isInteger(floor)) currentFloor = floor
  const src = currentSrc()
  if (src) minimap?.webContents.send('minimap:src', src)
  return { map: currentMap, floor: currentFloor, src }
})
ipcMain.handle('minimap:bg', (_e, v) => {
  currentBg = Math.min(1, Math.max(0, Number(v) || 0))
  setSetting('background', currentBg)
  minimap?.webContents.send('minimap:bg', currentBg)
})
ipcMain.handle('gui:updatestatus', () => lastUpdateCheck)
ipcMain.handle('gui:checknow', async () => checkForMapUpdates())
ipcMain.handle('gui:checkappupdate', () => {
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {})
  return true
})
ipcMain.handle('gui:installupdate', () => {
  autoUpdater.quitAndInstall(false, true)
})
ipcMain.handle('gui:minimize', () => {
  // Minimize only the control panel, not the minimap overlay.
  if (gui) gui.minimize()
})
ipcMain.handle('gui:resetpos', () => {
  resetMinimapPosition()
  return true
})
ipcMain.handle('gui:quit', () => app.quit())

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  app.quit()
})
