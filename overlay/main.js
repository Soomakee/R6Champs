const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
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
const GH_HEADERS = { 'User-Agent': 'R6Legends-Overlay', Accept: 'application/vnd.github+json' }

let lastUpdateCheck = { at: null, ok: null, added: 0, updated: 0, error: null }

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
      if (known[entry.path] === entry.sha && fs.existsSync(dest)) continue
      const raw = await ghFetch(`${RAW_BASE}/${encodeURI(entry.path)}`)
      if (raw.status !== 200) continue
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, raw.body)
      known[entry.path] = entry.sha
      added++
    }
    writeUpdateState({ head, files: known })
    lastUpdateCheck = { at: Date.now(), ok: true, added, updated: 0, error: null }
    if (added > 0) broadcastUpdate()
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

function broadcastAppUpdate(status) {
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
        const src = 'file:///' + floor.file.replace(/\\/g, '/')
        const existing = out[entry.name].find((x) => x.name === floor.name)
        if (existing) existing.src = src
        else out[entry.name].push({ name: floor.name, src })
        seen.add(key)
      }
    }
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  }
  return out
}

// Current selection (map name, floor index) shared between the GUI and minimap
let currentMap = process.env.MINIMAP_MAP || 'Calypso Casino'
let currentFloor = 0
let currentBg = 0.14 // background wash opacity (0 = none)

let minimap = null
let gui = null

function currentSrc() {
  const manifest = scanOverlays()
  const floors = manifest[currentMap] || []
  const floor = floors[Math.min(currentFloor, floors.length - 1)]
  return floor ? floor.src : null
}

function createMinimap() {
  minimap = new BrowserWindow({
    width: 460,
    height: 340,
    minWidth: 120,
    minHeight: 90,
    frame: false,
    transparent: true,
    hasShadow: false,
    // NOTE: no backgroundColor here — setting any background color (even
    // '#00000000') makes transparent windows render solid black on Windows.
    alwaysOnTop: true,
    title: 'Minimap',
    webPreferences: {
      preload: path.join(__dirname, 'preload-minimap.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  minimap.setAlwaysOnTop(true, 'screen-saver')
  minimap.loadFile(path.join(__dirname, 'minimap.html'))
  // Hand the page its image (and any later changes) once it's up
  minimap.webContents.on('did-finish-load', () => {
    const src = currentSrc()
    if (src) minimap.webContents.send('minimap:src', src)
    minimap.webContents.send('minimap:bg', currentBg)
  })
  minimap.on('closed', () => (minimap = null))
}

function createGui() {
  gui = new BrowserWindow({
    width: 280,
    height: 158,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
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
    })
  })
  gui.on('closed', () => (gui = null))
}

app.whenReady().then(() => {
  // One-time repair for the early buggy build: it downloaded overlays into
  // userData/Map Blueprints Overlays (via a '..' path join) instead of
  // userData/overlays. Migrate everything over, then remove the stray dir.
  try {
    const stray = path.join(app.getPath('userData'), 'Map Blueprints Overlays')
    if (fs.existsSync(stray)) {
      fs.cpSync(stray, OVERLAYS_DIR, { recursive: true, force: true })
      fs.rmSync(stray, { recursive: true, force: true })
    }
    fs.rmSync(path.join(app.getPath('userData'), 'assets'), { recursive: true, force: true })
  } catch {}

  createMinimap()
  createGui()

  // Ctrl+Shift+H hides/shows the minimap from anywhere (e.g. in-game)
  globalShortcut.register('Ctrl+Shift+H', () => toggleMinimap())
  // Ctrl+Shift+O pins/unpins (always-on-top toggle)
  globalShortcut.register('Ctrl+Shift+O', () => {
    if (!minimap) return
    const pinned = minimap.isAlwaysOnTop()
    minimap.setAlwaysOnTop(!pinned, 'screen-saver')
  })

  // Map auto-update: check now, then every 30 minutes
  checkForMapUpdates()
  setInterval(checkForMapUpdates, 30 * 60 * 1000)

  // App self-update (only meaningful when packaged; skipped in dev)
  if (app.isPackaged) {
    initUpdater(broadcastAppUpdate)
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }
})

function toggleMinimap() {
  if (!minimap) return
  if (minimap.isVisible()) minimap.hide()
  else minimap.show()
}

// --- IPC from the GUI window ---
ipcMain.handle('minimap:opacity', (_e, v) => {
  if (minimap) minimap.setOpacity(Math.min(1, Math.max(0, Number(v) || 0)))
})
ipcMain.handle('minimap:visible', (_e, on) => {
  if (!minimap) return
  if (on) minimap.show()
  else minimap.hide()
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
  const width = Math.min(1400, Math.max(180, Math.round(Number(w) || 460)))
  minimap.setSize(width, Math.round(width * 0.75))
  return width
})
ipcMain.handle('minimap:getwidth', () => {
  if (!minimap) return 460
  const [w] = minimap.getSize()
  return w
})
ipcMain.handle('gui:manifest', () => ({
  manifest: scanOverlays(),
  map: currentMap,
  floor: currentFloor,
  width: minimap ? minimap.getSize()[0] : 460,
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
  minimap?.webContents.send('minimap:bg', currentBg)
})
ipcMain.handle('gui:updatestatus', () => lastUpdateCheck)
ipcMain.handle('gui:checknow', async () => checkForMapUpdates())
ipcMain.handle('gui:installupdate', () => {
  autoUpdater.quitAndInstall(false, true)
})
ipcMain.handle('gui:quit', () => app.quit())

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  app.quit()
})
