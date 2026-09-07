import { useEffect, useState } from 'react'
import { MAPS } from '../data/maps.js'
import blueprints from 'virtual:blueprints'
import { BlueprintViewer } from './MapPage.jsx'

/**
 * Compact layout for the desktop overlay app (Electron window that stays on
 * top of the game). Loaded when the site URL has ?view=overlay.
 *
 * HUD levels:
 *   full   — bar (logo, map, opacity, window controls) + floor tabs
 *   mini   — one tiny strip: map + floor dropdowns, no tabs row
 *   hidden — nothing but the blueprint; a small corner pill restores the HUD
 *
 * The bar doubles as the window drag handle (-webkit-app-region: drag), and
 * window control buttons talk to Electron via window.overlayAPI
 * (see overlay/preload.js). In a normal browser those buttons simply hide.
 */
const store = {
  get(key, fallback) {
    try {
      return localStorage.getItem('overlay:' + key) ?? fallback
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('overlay:' + key, value)
    } catch {}
  },
}

export default function OverlayPage() {
  const [slug, setSlug] = useState(() => store.get('map', MAPS[0]?.slug))
  const [floor, setFloor] = useState(() => Number(store.get('floor', 0)) || 0)
  // 'full' | 'mini' | 'hidden'
  const [hud, setHud] = useState(() => store.get('hud', 'full'))
  const [zoom, setZoom] = useState(() => Number(store.get('zoom', 1)) || 1)
  const map = MAPS.find((m) => m.slug === slug) || MAPS[0]
  const floors = blueprints[map?.name] || []
  const safeFloor = Math.min(floor, Math.max(floors.length - 1, 0))
  const api = typeof window !== 'undefined' ? window.overlayAPI : null

  useEffect(() => store.set('map', slug), [slug])
  useEffect(() => store.set('floor', String(safeFloor)), [safeFloor])
  useEffect(() => store.set('hud', hud), [hud])
  useEffect(() => store.set('zoom', String(zoom)), [zoom])

  const pickMap = (e) => {
    setSlug(e.target.value)
    setFloor(0)
  }

  return (
    <div className={'overlay-app overlay-app--' + hud}>
      <header className="overlay-bar">
        <img className="overlay-logo" src="/favicon.webp" alt="" width="18" height="18" />
        <select
          className="overlay-select"
          value={slug}
          onChange={pickMap}
          aria-label="Choose map"
        >
          {MAPS.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
        {hud === 'mini' && floors.length > 0 && (
          <select
            className="overlay-select overlay-select--floor"
            value={safeFloor}
            onChange={(e) => setFloor(Number(e.target.value))}
            aria-label="Choose floor"
          >
            {floors.map((f, i) => (
              <option key={f.src} value={i}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <div className="overlay-controls">
          <button
            type="button"
            className="overlay-btn"
            title={hud === 'full' ? 'Shrink to a mini strip' : 'Back to the full bar'}
            onClick={() => setHud(hud === 'full' ? 'mini' : 'full')}
          >
            {hud === 'full' ? '⌄' : '⌃'}
          </button>
          <button
            type="button"
            className="overlay-btn"
            title="Hide everything but the blueprint (the corner pill brings it back)"
            onClick={() => setHud('hidden')}
          >
            ⼁
          </button>
          {api && (
            <>
              <label className="overlay-opacity" title="Overlay opacity">
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  defaultValue="1"
                  onChange={(e) => api.setOpacity(Number(e.target.value))}
                />
              </label>
              <button type="button" className="overlay-btn" title="Minimize" onClick={() => api.minimize()}>
                —
              </button>
              <button type="button" className="overlay-btn overlay-btn--close" title="Close overlay" onClick={() => api.close()}>
                ✕
              </button>
            </>
          )}
        </div>
      </header>
      <main className="overlay-body">
        {map ? (
          <BlueprintViewer
            key={map.slug}
            mapName={map.name}
            floor={safeFloor}
            onFloorChange={setFloor}
            showTabs={hud !== 'mini'}
            zoomEnabled
            zoom={zoom}
            onZoomChange={setZoom}
          />
        ) : (
          <div className="blueprint-empty">No maps available.</div>
        )}
      </main>
      {hud === 'hidden' && (
        <div className="overlay-mini" title="Drag to move — click to bring the HUD back">
          <button
            type="button"
            className="overlay-mini-btn overlay-mini-btn--show"
            title="Bring the HUD back"
            onClick={() => setHud('mini')}
          >
            ⌃
          </button>
        </div>
      )}
    </div>
  )
}
