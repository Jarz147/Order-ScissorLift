import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AdminRoute({ children }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" />
      </div>
    )
  }
  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
