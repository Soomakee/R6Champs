/**
 * Small draggable GUI that controls the transparent minimap window:
 * opacity, size, show/hide, map + floor selectors, quit. Runs in its own
 * always-on-top Electron window (see overlay/main.js). Falls back to inert
 * controls in a browser.
 */
import { useEffect, useState } from 'react'

export default function MinimapGuiPage() {
  const api = typeof window !== 'undefined' ? window.guiAPI : null
  const [visible, setVisible] = useState(true)
  const [manifest, setManifest] = useState(null)
  const [map, setMap] = useState(null)
  const [floor, setFloor] = useState(0)
  const [size, setSize] = useState(460)
  const [update, setUpdate] = useState(null)

  // Load the map/floor manifest once (browser fallback: static demo entry)
  useEffect(() => {
    if (api?.getManifest) {
      api.getManifest().then(({ manifest, map, floor, width }) => {
        setManifest(manifest)
        setMap(map)
        setFloor(floor)
        if (width) setSize(width)
      })
    } else {
      setManifest({ 'Calypso Casino': [{ name: 'Basement' }] })
      setMap('Calypso Casino')
      setFloor(0)
    }
    // Update status (only exists in the Electron app)
    api?.updateStatus?.().then(setUpdate)
  }, [api])

  const maps = manifest ? Object.keys(manifest) : []
  const floors = (manifest && map && manifest[map]) || []

  const pickMap = (name) => {
    setMap(name)
    setFloor(0)
    api?.select?.({ map: name, floor: 0 })
  }
  const pickFloor = (idx) => {
    setFloor(idx)
    api?.select?.({ floor: idx })
  }

  return (
    <div className="mmgui-root">
      <div className="mmgui-bar">
        <span className="mmgui-title">Minimap</span>
        <button
          type="button"
          className="mmgui-btn mmgui-btn--close"
          title="Quit the minimap app"
          onClick={() => api?.quit()}
        >
          ✕
        </button>
      </div>
      <div className="mmgui-controls">
        <select
          className="mmgui-select"
          title="Map"
          value={map ?? ''}
          onChange={(e) => pickMap(e.target.value)}
        >
          {maps.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="mmgui-select"
          title="Floor"
          value={floor}
          disabled={!floors.length}
          onChange={(e) => pickFloor(Number(e.target.value))}
        >
          {floors.map((f, i) => (
            <option key={f.name} value={i}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mmgui-controls">
        <label className="mmgui-slider" title="Background wash opacity">
          <span className="mmgui-label">Background</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.14"
            onChange={(e) => api?.setBg(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="mmgui-controls">
        <label className="mmgui-slider" title="Minimap size">
          <span className="mmgui-label">Size</span>
          <input
            type="range"
            min="180"
            max="1400"
            step="10"
            value={size}
            onChange={(e) => {
              const w = Number(e.target.value)
              setSize(w)
              api?.setWidth(w)
            }}
          />
        </label>
        <button
          type="button"
          className="mmgui-btn"
          title="Show / hide the minimap"
          onClick={() => {
            const next = !visible
            setVisible(next)
            api?.setVisible(next)
          }}
        >
          {visible ? '👁' : '🚫'}
        </button>
      </div>
      {api?.checkNow && (
        <div className="mmgui-controls mmgui-controls--update">
          <button
            type="button"
            className="mmgui-btn mmgui-btn--update"
            title="Check GitHub for new/updated map overlays"
            onClick={async () => {
              setUpdate({ ok: null })
              const res = await api.checkNow()
              setUpdate(res)
              const m = await api.getManifest()
              setManifest(m.manifest)
            }}
          >
            ↻ Check for map updates
          </button>
          {update?.ok === true && (
            <span className="mmgui-update-note">
              {update.upToDate || update.added === 0 ? 'Up to date' : `+${update.added} map image(s)`}
            </span>
          )}
          {update?.ok === false && <span className="mmgui-update-note">Offline</span>}
        </div>
      )}
    </div>
  )
}
