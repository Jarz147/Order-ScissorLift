import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const IMAGE_BUCKET = 'lift-images'

export default function AdminLifts() {
  const [lifts, setLifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    code: '',
    capacity_kg: '',
    description: '',
    image_url: '',
    status: 'available',
  })
  const [imageFile, setImageFile] = useState(null)
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
    const channel = supabase
      .channel('adminlifts-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lifts' },
        () => load(),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    let imageUrl = form.image_url || null
    if (imageFile) {
      const ext = (imageFile.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, imageFile, { upsert: true })
      if (upErr) {
        setBusy(false)
        setError('Gagal mengunggah gambar: ' + upErr.message)
        return
      }
      const { data: pub } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
      imageUrl = pub.publicUrl
    }

    const { error } = await supabase.from('lifts').insert({
      name: form.name,
      code: form.code,
      capacity_kg: form.capacity_kg ? Number(form.capacity_kg) : null,
      description: form.description || null,
      image_url: imageUrl,
      status: form.status,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', code: '', capacity_kg: '', description: '', image_url: '', status: 'available' })
    setImageFile(null)
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

  const handleRowImage = async (lift, file) => {
    if (!file) return
    setError('')
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${lift.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { upsert: true })
    if (upErr) {
      setBusy(false)
      setError('Gagal mengunggah gambar: ' + upErr.message)
      return
    }
    const { data: pub } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
    const { error } = await supabase.from('lifts').update({ image_url: pub.publicUrl }).eq('id', lift.id)
    setBusy(false)
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
          <label>
            URL Gambar (atau unggah file di bawah)
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://contoh.com/gambar-lift.jpg"
            />
          </label>
          <label>
            Upload Gambar dari File
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
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
              {lift.image_url && (
                <img className="thumb" src={lift.image_url} alt={lift.name} />
              )}
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
                <label className="btn btn--ghost">
                  {busy ? 'Mengunggah...' : 'Upload Gambar'}
                  <input
                    type="file"
                    accept="image/*"
                    className="visually-hidden"
                    onChange={(e) => handleRowImage(lift, e.target.files?.[0])}
                  />
                </label>
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
