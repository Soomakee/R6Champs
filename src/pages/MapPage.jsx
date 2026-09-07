import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MAPS } from '../data/maps.js'
import blueprints from 'virtual:blueprints'

function BlueprintViewer({ mapName }) {
  const floors = blueprints[mapName] || []
  const [active, setActive] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const stageRef = useRef(null)

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

  return (
    <section className="blueprints" aria-label={`${mapName} blueprints`}>
      <div className="blueprint-controls">
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
      <figure ref={stageRef} className="blueprint-stage">
        <img
          key={current.src}
          src={current.src}
          alt={`${mapName} — ${current.name} blueprint`}
        />
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
