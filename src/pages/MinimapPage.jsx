/**
 * Transparent minimap page for the Electron minimap window.
 * Shows ONLY the requested blueprint image — no chrome, no background.
 * The whole image is a drag handle (moves the always-on-top window).
 * The Electron main process pushes the image src via minimimAPI.onSrc;
 * falls back to the ?src= query param / Calypso Basement default.
 */
import { useEffect, useState } from 'react'

const FALLBACK = '/Map%20Blueprints%20Overlays/Calypso%20Casino/Basement.png'

export default function MinimapPage() {
  const [src, setSrc] = useState(
    () => new URLSearchParams(window.location.search).get('src') || FALLBACK
  )
  const [bg, setBg] = useState(0.14)
  const api = typeof window !== 'undefined' ? window.minimapAPI : null

  useEffect(() => {
    api?.onSrc?.(setSrc)
    api?.onBg?.(setBg)
  }, [api])

  return (
    <div className="minimap-root">
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        className="minimap-img"
        src={src}
        draggable={false}
        style={{
          background: bg > 0 ? `rgba(128, 128, 128, ${bg})` : 'transparent',
          ...(api ? {} : { WebkitAppRegion: 'drag' }),
        }}
        onDoubleClick={() => api?.close()}
      />
    </div>
  )
}
