import { useEffect, useState } from 'react'

/**
 * Map image with a graceful fallback.
 *
 * Images live in two project-root folders:
 *   assets/Map Thumbnails/  → home grid cards  (folder="thumbnails")
 *   assets/Map Blueprints/  → detail page hero (folder="blueprints")
 *
 * Naming: <Map Name>.<ext>, exactly as the map's display name in
 * src/data/maps.js — e.g. "Kafe Dostoyevsky.webp" or "Bank.jpg".
 * Extensions are tried in this order: jpg, png, webp, jpeg.
 * Example: assets/Map Thumbnails/Kafe Dostoyevsky.webp
 *
 * If no image is found, a monogram tile ("Artwork pending") renders instead.
 * Paths are URL-encoded because the folder names contain spaces.
 * Note: Vite's publicDir is `assets/`, so its contents are served at the site
 * root — assets/Map Thumbnails/x.jpg is fetched as /Map%20Thumbnails/x.jpg.
 */

const EXTENSIONS = ['webp', 'jpg', 'png', 'jpeg']

const FOLDERS = {
  thumbnails: 'Map Thumbnails',
  blueprints: 'Map Blueprints',
}

export default function MapThumb({
  slug,
  name,
  folder = 'thumbnails',
  className = '',
}) {
  const [candidates] = useState(() => {
    const dir = FOLDERS[folder] || FOLDERS.thumbnails
    return EXTENSIONS.map(
      (ext) => `/${encodeURIComponent(dir)}/${encodeURIComponent(name)}.${ext}`,
    )
  })
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const exhausted = idx >= candidates.length

  // Reset when the map or folder changes.
  useEffect(() => {
    setIdx(0)
    setLoaded(false)
  }, [name, folder])

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  if (exhausted) {
    return (
      <div className={`map-thumb map-thumb--fallback ${className}`} aria-hidden="true">
        <span className="map-thumb-initials">{initials}</span>
        <span className="map-thumb-label">Artwork pending</span>
      </div>
    )
  }

  return (
    <div className={`map-thumb ${className}`} aria-hidden="true">
      {!loaded && (
        <div className="map-thumb-skeleton">
          <span className="map-thumb-initials">{initials}</span>
        </div>
      )}
      <img
        src={candidates[idx]}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setIdx((i) => i + 1)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  )
}
