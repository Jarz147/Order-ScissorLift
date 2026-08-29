import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminLifts() {
  const [lifts, setLifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    code: '',
    capacity_kg: '',
    description: '',
    status: 'available',
  })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('lifts')
      .select('*')
      .order('name')
    if (error) setError(error.message)
    else setLifts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.from('lifts').insert({
      name: form.name,
      code: form.code,
      capacity_kg: form.capacity_kg ? Number(form.capacity_kg) : null,
      description: form.description || null,
      status: form.status,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', code: '', capacity_kg: '', description: '', status: 'available' })
    load()
  }

  const handleStatus = async (lift, status) => {
    setError('')
    const { error } = await supabase.from('lifts').update({ status }).eq('id', lift.id)
    if (error) setError(error.message)
    else load()
  }

  const handleDelete = async (lift) => {
    if (!window.confirm(`Hapus lift "${lift.name}"? Pemesanan terkait ikut terhapus.`)) return
    setError('')
    const { error } = await supabase.from('lifts').delete().eq('id', lift.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <h1>Kelola Scissor Lift</h1>
      {error && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <h3>Tambah Lift</h3>
        <form onSubmit={handleCreate} className="form">
          <div className="form__row">
            <label>
              Nama
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Kode
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="SL-001"
                required
              />
            </label>
          </div>
          <div className="form__row">
            <label>
              Kapasitas (kg)
              <input
                type="number"
                value={form.capacity_kg}
                onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="available">Tersedia</option>
                <option value="maintenance">Perawatan</option>
              </select>
            </label>
          </div>
          <label>
            Deskripsi
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Tambah Lift'}
          </button>
        </form>
      </div>

      <h2>Daftar Lift</h2>
      {loading ? (
        <div className="centered">
          <div className="spinner" />
        </div>
      ) : (
        <div className="list">
          {lifts.map((lift) => (
            <div key={lift.id} className="card card--row">
              <div className="card__info">
                <strong>
                  {lift.name} <span className="badge badge--muted">{lift.code}</span>
                </strong>
                <span className="muted small">
                  Kapasitas {lift.capacity_kg ? lift.capacity_kg + ' kg' : 'n/a'} •{' '}
                  {lift.description || 'tanpa deskripsi'}
                </span>
              </div>
              <div className="card__actions">
                <select
                  value={lift.status}
                  onChange={(e) => handleStatus(lift, e.target.value)}
                  className="select"
                >
                  <option value="available">Tersedia</option>
                  <option value="maintenance">Perawatan</option>
                </select>
                <button onClick={() => handleDelete(lift)} className="btn btn--danger">
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {lifts.length === 0 && <p className="muted">Belum ada lift.</p>}
        </div>
      )}
    </div>
  )
}
