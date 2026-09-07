import { Link } from 'react-router-dom'
import { MAPS } from '../data/maps.js'
import MapThumb from '../components/MapThumb.jsx'

export default function MapsPage() {
  return (
    <section className="section">
      <div className="section-head">
        <p className="eyebrow">The Library</p>
        <h1>Maps</h1>
        <p className="lede">
          Pick a map to open its strategy page. Fourteen ranked maps, one
          goal — win more rounds.
        </p>
      </div>
      <div className="map-grid">
        {MAPS.map((map, i) => (
          <Link
            key={map.slug}
            to={`/maps/${map.slug}`}
            className="map-card"
            style={{ '--i': i }}
          >
            <MapThumb name={map.name} />
            <span className="map-card-name">{map.name}</span>
            <span className="map-card-cta">View map →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
