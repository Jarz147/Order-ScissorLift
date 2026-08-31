import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, STORAGE_BUCKET } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Booking() {
  const { liftId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [lift, setLift] = useState(null)
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('lifts')
      .select('*')
      .eq('id', liftId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }
        setLift(data)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [liftId])

  const checkConflict = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('lift_id', liftId)
      .eq('status', 'confirmed')
    if (error) {
      setError(error.message)
      return false
    }
    if (data.length > 0) {
      setConflict(true)
      setError('Scissor lift sudah dipesan dan sedang tidak tersedia untuk dipesan.')
      return false
    }
    setConflict(false)
    setError('')
    return true
  }

  const handleDateChange = (setter) => (e) => {
    const value = e.target.value
    setter(value)
    checkConflict()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (lift?.status === 'maintenance') {
      setError('Scissor lift sedang dalam perawatan dan tidak dapat dipesan.')
      return
    }

    if (!startDate || !endDate) {
      setError('Tanggal mulai dan selesai wajib diisi.')
      return
    }
    if (endDate < startDate) {
      setError('Tanggal selesai tidak boleh sebelum tanggal mulai.')
      return
    }

    const free = await checkConflict()
    if (!free) return

    setSubmitting(true)

    let documentPath = null
    if (file) {
      const ext = file.name.split('.').pop()
      documentPath = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(documentPath, file)
      if (upErr) {
        setSubmitting(false)
        setError('Gagal mengunggah dokumen: ' + upErr.message)
        return
      }
    }

    const { error: insErr } = await supabase.from('bookings').insert({
      lift_id: liftId,
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      note: note || null,
      document_path: documentPath,
      status: 'confirmed',
    })

    setSubmitting(false)

    if (insErr) {
      if (insErr.code === '23P01') {
        setConflict(true)
        setError('Scissor lift sudah dipesan oleh user lain (data terbaru) dan tidak dapat dipesan lagi.')
      } else {
        setError(insErr.message)
      }
      return
    }

    navigate('/dashboard')
  }

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="booking">
      <h1>Pesan Scissor Lift</h1>
      {error && <div className="alert alert--error">{error}</div>}
      {lift && (
        <div className="card">
          <div className="card__head">
            <h3>{lift.name}</h3>
            <span className="badge badge--muted">{lift.code}</span>
          </div>
          <p className="muted">Kapasitas: {lift.capacity_kg} kg</p>
          <form onSubmit={handleSubmit} className="form">
            <div className="form__row">
              <label>
                Tanggal mulai
                <input
                  type="date"
                  value={startDate}
                  onChange={handleDateChange(setStartDate)}
                  min={todayISO()}
                  required
                />
              </label>
              <label>
                Tanggal selesai
                <input
                  type="date"
                  value={endDate}
                  onChange={handleDateChange(setEndDate)}
                  min={startDate}
                  required
                />
              </label>
            </div>
            <label>
              Catatan
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Keperluan pemakaian, lokasi, dll."
              />
            </label>
            <label>
              Lampirkan dokumen (opsional)
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {conflict && (
              <div className="alert alert--error">
                Lift tidak dapat dipesan pada rentang tanggal yang dipilih.
              </div>
            )}
            {lift.status === 'maintenance' && (
              <div className="alert alert--error">
                Lift sedang dalam perawatan dan tidak dapat dipesan.
              </div>
            )}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || conflict || lift.status === 'maintenance'}
            >
              {submitting ? 'Menyimpan...' : 'Konfirmasi Pemesanan'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
