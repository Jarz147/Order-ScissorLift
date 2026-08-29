import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [lifts, setLifts] = useState([])
  const [bookedMap, setBookedMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const { data: liftData, error: liftErr } = await supabase
        .from('lifts')
        .select('*')
        .order('name')

      const { data: bookingData, error: bookingErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'confirmed')
        .gte('end_date', todayISO())

      if (cancelled) return
      if (liftErr || bookingErr) {
        setError(liftErr?.message || bookingErr?.message || 'Gagal memuat data.')
        setLoading(false)
        return
      }

      const map = {}
      for (const b of bookingData) {
        if (!map[b.lift_id]) map[b.lift_id] = []
        map[b.lift_id].push(b)
      }
      setLifts(liftData)
      setBookedMap(map)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const isBookedToday = (liftId) => {
    const list = bookedMap[liftId] || []
    const today = todayISO()
    return list.some((b) => b.start_date <= today && b.end_date >= today)
  }

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <h1>Daftar Scissor Lift</h1>
      {error && <div className="alert alert--error">{error}</div>}
      <div className="grid">
        {lifts.map((lift) => {
          const bookedToday = isBookedToday(lift.id)
          const nextBookings = bookedMap[lift.id] || []
          const firstNext = nextBookings
            .slice()
            .sort((a, b) => (a.start_date < b.start_date ? -1 : 1))[0]
          return (
            <div key={lift.id} className="card">
              <div className="card__head">
                <h3>{lift.name}</h3>
                <span className="badge badge--muted">{lift.code}</span>
              </div>
              <p className="muted">{lift.description}</p>
              <div className="card__meta">
                <span>Kapasitas: {lift.capacity_kg} kg</span>
                {lift.status === 'maintenance' ? (
                  <span className="badge badge--maintenance">Sedang perawatan</span>
                ) : bookedToday ? (
                  <span className="badge badge--error">Dipinjam hari ini</span>
                ) : (
                  <span className="badge badge--ok">Siap dipakai</span>
                )}
              </div>
              {lift.status === 'maintenance' && (
                <p className="muted small">Lift tidak tersedia untuk pemesanan saat perawatan.</p>
              )}
              {firstNext && (
                <p className="muted small">
                  Pemesanan berikutnya:{' '}
                  {new Date(firstNext.start_date).toLocaleDateString('id-ID')} –
                  {new Date(firstNext.end_date).toLocaleDateString('id-ID')}
                </p>
              )}
              <div className="card__actions">
                {lift.status === 'maintenance' ? (
                  <button className="btn btn--block" disabled>
                    Tidak tersedia
                  </button>
                ) : (
                  <Link to={`/booking/${lift.id}`} className="btn btn--primary btn--block">
                    Pesan
                  </Link>
                )}
              </div>
            </div>
          )
        })}
        {lifts.length === 0 && (
          <p className="muted">Belum ada scissor lift. Minta admin untuk menambahkannya.</p>
        )}
      </div>
    </div>
  )
}
