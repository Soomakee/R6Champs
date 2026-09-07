import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MAPS } from '../data/maps.js'
import blueprints from 'virtual:blueprints'

const MAX_ZOOM = 5

export function BlueprintViewer({ mapName, floor: floorProp, onFloorChange, showTabs = true, zoomEnabled, zoom: zoomProp, onZoomChange }) {
  const floors = blueprints[mapName] || []
  const [activeState, setActiveState] = useState(0)
  const active = floorProp !== undefined ? floorProp : activeState
  const setActive = (i) => (onFloorChange ? onFloorChange(i) : setActiveState(i))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const stageRef = useRef(null)
  const panRef = useRef(null)
  const fitRef = useRef(0)
  const anchorRef = useRef(null)

  // Zoom is opt-in (used by the overlay app). Continuous, scroll-driven, and
  // measured relative to the fit size: 100% = whole blueprint visible, so a
  // small scroll is a gentle zoom, not a jump to full resolution.
  const zoom = zoomProp !== undefined ? zoomProp : 1
  const zoomed = Boolean(zoomEnabled) && zoom > 1
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(1, Math.round(z * 100) / 100))

  const setZoom = (next, anchor) => {
    if (!zoomEnabled) return
    const clamped = clampZoom(next)
    if (clamped === zoomRef.current) return
    if (anchor) anchorRef.current = anchor
    onZoomChange ? onZoomChange(clamped) : undefined
  }

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  if (floors.length === 0) {
    return (
      <div className="blueprint-empty">
        No blueprints yet for {mapName}. Drop floor images into{' '}
        <code>assets/Map Blueprints/{mapName}/</code> and they&apos;ll appear
        here as tabs automatically.
      </div>
    )
  }

  const current = floors[Math.min(active, floors.length - 1)]

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else if (stageRef.current?.requestFullscreen) {
      stageRef.current.requestFullscreen().catch(() => {})
    }
  }

  // Track the blueprint's fit width so zoom stays relative to "whole image visible"
  useEffect(() => {
    if (!zoomEnabled) return
    const measure = () => {
      const el = stageRef.current
      const img = el?.querySelector('img')
      if (!el || !img || !img.naturalWidth) return
      const cs = getComputedStyle(el)
      const availW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const availH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      fitRef.current = Math.min(availW, availH * (img.naturalWidth / img.naturalHeight))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })

  // Scroll-wheel zoom, anchored at the cursor
  useEffect(() => {
    if (!zoomEnabled) return
    const el = stageRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const cur = zoomRef.current
      const next = clampZoom(cur * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
      if (next === cur) return
      const rect = el.getBoundingClientRect()
      anchorRef.current = { cx: e.clientX - rect.left, cy: e.clientY - rect.top, oldZoom: cur }
      onZoomChange ? onZoomChange(next) : undefined
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomEnabled, onZoomChange])

  // Anchor the zoom at the cursor, or center when switching floors
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const anchor = anchorRef.current
    anchorRef.current = null
    if (anchor && zoomed && anchor.oldZoom !== zoom) {
      const ratio = zoom / anchor.oldZoom
      el.scrollLeft = (el.scrollLeft + anchor.cx) * ratio - anchor.cx
      el.scrollTop = (el.scrollTop + anchor.cy) * ratio - anchor.cy
    } else if (zoomed) {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
    }
  }, [zoom, active, zoomed])

  const onPointerDown = (e) => {
    if (!zoomed) return
    const el = stageRef.current
    panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const p = panRef.current
    if (!p) return
    const el = stageRef.current
    el.scrollLeft = p.left - (e.clientX - p.x)
    el.scrollTop = p.top - (e.clientY - p.y)
  }

  const endPan = () => {
    panRef.current = null
  }

  return (
    <section className="blueprints" aria-label={`${mapName} blueprints`}>
      <div className="blueprint-controls" style={showTabs ? undefined : { display: 'none' }}>
        <div className="blueprint-tabs" role="tablist">
          {floors.map((floor, i) => (
            <button
              key={floor.src}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={'blueprint-tab' + (i === active ? ' blueprint-tab--active' : '')}
              onClick={() => setActive(i)}
            >
              {floor.name}
            </button>
          ))}
        </div>
        <div className="blueprint-tools">
          <button
            type="button"
            className="blueprint-tool"
            title="Show the whole blueprint as large as the screen allows"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? '✕ Exit fullscreen' : '⤢ Fullscreen'}
          </button>
        </div>
      </div>
      <figure
        ref={stageRef}
        className={'blueprint-stage' + (zoomed ? ' blueprint-stage--zoom' : '')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
        onPointerCancel={endPan}
      >
        <img
          key={current.src}
          src={current.src}
          alt={`${mapName} — ${current.name} blueprint`}
          draggable={false}
          onLoad={() => {
            if (zoomEnabled) {
              // re-measure the fit size for the freshly loaded floor
              const el = stageRef.current
              const img = el?.querySelector('img')
              if (el && img && img.naturalWidth) {
                const cs = getComputedStyle(el)
                const availW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
                const availH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
                fitRef.current = Math.min(availW, availH * (img.naturalWidth / img.naturalHeight))
              }
            }
          }}
          style={zoomed && fitRef.current ? { width: Math.round(fitRef.current * zoom) } : undefined}
        />
        {zoomEnabled && (
          <div className="blueprint-zoom" role="group" aria-label="Blueprint zoom">
            <button
              type="button"
              onClick={() => setZoom(zoom / 1.25)}
              disabled={zoom <= 1}
              title="Zoom out (or scroll down)"
            >
              −
            </button>
            <button
              type="button"
              className="blueprint-zoom-value"
              onClick={() => setZoom(1)}
              title="Reset to fit (100%)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(zoom * 1.25)}
              disabled={zoom >= MAX_ZOOM}
              title="Zoom in (or scroll up) — drag to pan"
            >
              +
            </button>
          </div>
        )}
        <button
          type="button"
          className="blueprint-exit"
          onClick={toggleFullscreen}
          aria-label="Exit fullscreen"
          title="Exit fullscreen (Esc)">
          ✕ Exit
        </button>
        <div className="blueprint-stage-tabs" role="tablist" aria-label={`${mapName} floors`}>
          {floors.map((floor, i) => (
            <button
              key={floor.src}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={'blueprint-tab' + (i === active ? ' blueprint-tab--active' : '')}
              onClick={() => setActive(i)}
            >
              {floor.name}
            </button>
          ))}
        </div>
      </figure>
    </section>
  )
}

export default function MapPage() {
  const { slug } = useParams()
  const map = MAPS.find((m) => m.slug === slug)
  const index = MAPS.findIndex((m) => m.slug === slug)
  const prev = index > 0 ? MAPS[index - 1] : null
  const next = index >= 0 && index < MAPS.length - 1 ? MAPS[index + 1] : null

  if (!map) {
    return (
      <section className="section">
        <h1>Map not found</h1>
        <p className="lede">That map isn&apos;t in the library yet.</p>
        <Link className="btn btn--ghost" to="/maps">
          ← Back to Maps
        </Link>
      </section>
    )
  }

  return (
    <section className="section section--map">
      <Link to="/maps" className="back-link">
        ← All maps
      </Link>
      <div className="map-hero">
        <div className="map-hero-body">
          <p className="eyebrow">Map {String(index + 1).padStart(2, '0')} / {MAPS.length}</p>
          <h1>{map.name}</h1>
          <p className="lede">
            Floor-by-floor blueprints for {map.name}. Pick a level to explore
            the site.
          </p>
        </div>
      </div>
      <BlueprintViewer key={map.slug} mapName={map.name} />
      <div className="map-footer-nav">
        {prev ? (
          <Link to={`/maps/${prev.slug}`} className="map-nav-card">
            <span className="map-nav-label">Previous</span>
            <span className="map-nav-name">← {prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/maps/${next.slug}`} className="map-nav-card map-nav-card--right">
            <span className="map-nav-label">Next</span>
            <span className="map-nav-name">{next.name} →</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </section>
  )
}
