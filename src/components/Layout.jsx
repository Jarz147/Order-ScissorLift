import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    'nav-link' + (isActive ? ' nav-link--active' : '')

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">ScissorLift Reservasi</div>
        <nav className="topbar__nav">
          <NavLink to="/dashboard" className={linkClass}>
            Daftar Lift
          </NavLink>
          {profile?.role === 'admin' && (
            <>
              <NavLink to="/admin/users" className={linkClass}>
                Kelola User
              </NavLink>
              <NavLink to="/admin/lifts" className={linkClass}>
                Kelola Lift
              </NavLink>
              <NavLink to="/admin/bookings" className={linkClass}>
                Semua Pemesanan
              </NavLink>
            </>
          )}
        </nav>
        <div className="topbar__user">
          <span className="topbar__name">
            {profile?.full_name || user?.email}
            {profile?.role === 'admin' && (
              <span className="badge badge--admin">admin</span>
            )}
          </span>
          <button onClick={handleSignOut} className="btn btn--ghost">
            Keluar
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
