import { NavLink, Link } from 'react-router-dom'

const tabs = [
  { to: '/maps', label: 'Maps' },
  { to: '/special-thanks', label: 'Special Thanks' },
  { to: '/donate', label: 'Donate' },
]

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <img className="brand-mark" src="/favicon.webp" alt="R6Champs logo" width="34" height="34" />
          <span className="brand-name">Champs</span>
        </Link>
        <nav className="nav-tabs">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                'nav-tab' + (isActive ? ' nav-tab--active' : '')
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
