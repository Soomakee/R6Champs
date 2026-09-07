import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import MapsPage from './pages/MapsPage.jsx'
import MapPage from './pages/MapPage.jsx'
import SpecialThanksPage from './pages/SpecialThanksPage.jsx'
import DonatePage from './pages/DonatePage.jsx'
import OverlayPage from './pages/OverlayPage.jsx'
import { MAPS } from './data/maps.js'

export default function App() {
  // Compact mode for the desktop overlay app (Electron window over the game)
  if (new URLSearchParams(window.location.search).get('view') === 'overlay') {
    return <OverlayPage />
  }

  return (
    <div className="app">
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<MapsPage />} />
          <Route path="/maps" element={<MapsPage />} />
          <Route path="/maps/:slug" element={<MapPage maps={MAPS} />} />
          <Route path="/special-thanks" element={<SpecialThanksPage />} />
          <Route path="/donate" element={<DonatePage />} />
          <Route path="*" element={<MapsPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>R6Legends — a community strategy hub.</span>
        <span className="footer-note">Not affiliated with Ubisoft.</span>
      </footer>
    </div>
  )
}
