import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = path.join(ROOT, 'assets')
const BLUEPRINTS_DIR = path.join(ASSETS_DIR, 'Map Blueprints')
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i
const VIRTUAL_ID = 'virtual:blueprints'
const RESOLVED_ID = '\0' + VIRTUAL_ID

const MIME = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
}

/**
 * Scan assets/Map Blueprints/<Map Name>/<Floor>.<ext> into a manifest:
 *   { "Oregon": [{ name: "Basement", src: "/Map%20Blueprints/Oregon/Basement.webp" }, ...] }
 * Exposed to the app as `import blueprints from 'virtual:blueprints'`.
 * In dev the folder is watched; adding/removing images triggers a reload.
 */
function scanBlueprints() {
  if (!fs.existsSync(BLUEPRINTS_DIR)) return {}
  const out = {}
  for (const entry of fs.readdirSync(BLUEPRINTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const floors = fs
      .readdirSync(path.join(BLUEPRINTS_DIR, entry.name))
      .filter((f) => IMAGE_RE.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((f) => ({
        name: f.replace(IMAGE_RE, ''),
        src: `/Map%20Blueprints/${encodeURIComponent(entry.name)}/${encodeURIComponent(f)}`,
      }))
    out[entry.name] = floors
  }
  return out
}

/**
 * Serve files from assets/ (map artwork folders + root-level files like
 * favicon.webp) with our own middleware. Registered ahead of Vite's internal
 * middlewares so assets are always answered deterministically (Vite's
 * publicDir handling in dev proved flaky across restarts and builds).
 * Anything that isn't a real file inside assets/ falls through untouched.
 */
function assetsMiddleware(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()

  const pathname = (req.url || '').split('?')[0]
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return next()
  }
  if (!decoded || decoded.endsWith('/')) return next()

  const filePath = path.normalize(path.join(ASSETS_DIR, decoded))
  if (!filePath.startsWith(ASSETS_DIR + path.sep)) {
    res.statusCode = 403
    return res.end('Forbidden')
  }

  const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  if (!exists) {
    // Known artwork folders: answer 404 right away so <img> fallbacks fire fast.
    if (decoded.startsWith('/Map Thumbnails/') || decoded.startsWith('/Map Blueprints/')) {
      res.statusCode = 404
      return res.end('Not found')
    }
    return next()
  }

  const ext = path.extname(filePath).toLowerCase()
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  res.setHeader('Cache-Control', 'no-cache')
  fs.createReadStream(filePath).pipe(res)
}

function blueprintsManifest() {
  let manifest = {}
  let lastJson = ''
  let timer = null
  return {
    name: 'blueprints-manifest',
    buildStart() {
      manifest = scanBlueprints()
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      return `export default ${JSON.stringify(manifest)}`
    },
    configureServer(server) {
      server.middlewares.use(assetsMiddleware)

      server.watcher.add(BLUEPRINTS_DIR)
      server.watcher.on('all', (event, file) => {
        if (!file || !file.startsWith(BLUEPRINTS_DIR)) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          const next = scanBlueprints()
          const json = JSON.stringify(next)
          if (json === lastJson) return
          manifest = next
          lastJson = json
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }, 250)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), blueprintsManifest()],
  // assets/ is copied into the production build output; in dev the plugin's
  // middleware serves it (kept for build parity).
  publicDir: 'assets',
  server: {
    watch: {
      // Editors (e.g. Photoshop) hold locks on files here, which crashed
      // Vite's watcher with EBUSY. The overlays folder isn't part of the
      // manifest scan, so nothing needs live-reload from it.
      ignored: ['**/assets/Map Blueprints Overlays/**', '**/assets/Icon/**'],
    },
  },
})
