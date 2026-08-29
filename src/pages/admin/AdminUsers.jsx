import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminUsers() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'user' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setProfiles(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.rpc('admin_create_user', {
      p_email: form.email,
      p_password: form.password,
      p_full_name: form.full_name,
      p_role: form.role,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ full_name: '', email: '', password: '', role: 'user' })
    load()
  }

  const handleRoleChange = async (profile, role) => {
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profile.id)
    if (error) setError(error.message)
    else load()
  }

  const handleDelete = async (profile) => {
    if (!window.confirm(`Hapus user "${profile.full_name}"?`)) return
    setError('')
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: profile.id,
    })
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <h1>Kelola User</h1>
      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <h3>Tambah User</h3>
        <form onSubmit={handleCreate} className="form">
          <div className="form__row">
            <label>
              Nama lengkap
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="form__row">
            <label>
              Kata sandi awal
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
            </label>
            <label>
              Peran
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Membuat...' : 'Tambah User'}
          </button>
        </form>
      </div>

      <h2>Daftar User</h2>
      {loading ? (
        <div className="centered">
          <div className="spinner" />
        </div>
      ) : (
        <div className="list">
          {profiles.map((p) => (
            <div key={p.id} className="card card--row">
              <div className="card__info">
                <strong>{p.full_name}</strong>
                <span className="muted small">
                  {p.role === 'admin' ? 'Admin' : 'User'} • dibuat{' '}
                  {new Date(p.created_at).toLocaleDateString('id-ID')}
                </span>
              </div>
              <div className="card__actions">
                <select
                  value={p.role}
                  onChange={(e) => handleRoleChange(p, e.target.value)}
                  className="select"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => handleDelete(p)} className="btn btn--danger">
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {profiles.length === 0 && <p className="muted">Belum ada user.</p>}
        </div>
      )}
    </div>
  )
}
