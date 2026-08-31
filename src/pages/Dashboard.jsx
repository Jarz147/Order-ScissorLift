import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const statusLabel = {
  pending: 'Menunggu approval',
  confirmed: 'Dikonfirmasi',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  completed: 'Selesai',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [lifts, setLifts] = useState([])
  const [bookedMap, setBookedMap] = useState({})
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setError('')
      const { data: liftData, error: liftErr } = await supabase
        .from('lifts')
        .select('*')
        .order('name')

      const { data: bookingData, error: bookingErr } = await supabase
        .from('bookings')
        .select('*, lift:lifts(name, code), user:profiles(full_name)')
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (liftErr || bookingErr) {
        setError(liftErr?.message || bookingErr?.message || 'Gagal memuat data.')
        setLoading(false)
        return
      }

      const map = {}
      for (const b of bookingData) {
        if (b.status === 'pending' || b.status === 'confirmed') {
          if (!map[b.lift_id]) map[b.lift_id] = []
          map[b.lift_id].push(b)
        }
      }
      setLifts(liftData)
      setBookedMap(map)
      setLog(bookingData)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('dashboard-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lifts' },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const isBooked = (liftId) => (bookedMap[liftId] || []).length > 0

  const handleCancel = async (id) => {
    if (!window.confirm('Batalkan pemesanan ini?')) return
    setError('')
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (error) setError(error.message)
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
      <h1>Reservasi Scissor Lift</h1>
      {error && <div className="alert alert--error">{error}</div>}
      <div className="dashboard-layout">
        <div className="dashboard-lifts">
          <h2>Daftar Lift</h2>
          {lifts.map((lift) => {
            const booked = isBooked(lift.id)
            return (
              <div key={lift.id} className="card">
                {lift.image_url ? (
                  <img className="card__img" src={lift.image_url} alt={lift.name} />
                ) : (
                  <div className="card__img card__img--placeholder">Scissor Lift</div>
                )}
                <div className="card__head">
                  <h3>{lift.name}</h3>
                  <span className="badge badge--muted">{lift.code}</span>
                </div>
                <p className="muted">{lift.description}</p>
                <div className="card__meta">
                  <span>Kapasitas: {lift.capacity_kg} kg</span>
                  {lift.status === 'maintenance' ? (
                    <span className="badge badge--maintenance">Sedang perawatan</span>
                  ) : booked ? (
                    <span className="badge badge--error">Sedang dipesan</span>
                  ) : (
                    <span className="badge badge--ok">Siap dipakai</span>
                  )}
                </div>
                <div className="card__actions">
                  {lift.status === 'maintenance' ? (
                    <button className="btn btn--block" disabled>
                      Tidak tersedia
                    </button>
                  ) : booked ? (
                    <button className="btn btn--block" disabled>
                      Sedang digunakan
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

        <div className="dashboard-log">
          <h2>Log Pemesanan</h2>
          {log.length === 0 ? (
            <p className="muted">Belum ada pemesanan.</p>
          ) : (
            <div className="table-wrap">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>Lift</th>
                    <th>Pemesan</th>
                    <th>Tanggal Pakai</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.lift?.name}
                        <span className="muted small"> ({b.lift?.code})</span>
                      </td>
                      <td>{b.user?.full_name || '—'}</td>
                      <td>
                        {new Date(b.start_date).toLocaleDateString('id-ID')} –{' '}
                        {new Date(b.end_date).toLocaleDateString('id-ID')}
                      </td>
                      <td>
                        <span className={`badge badge--${b.status}`}>
                          {statusLabel[b.status]}
                        </span>
                      </td>
                      <td>
                        {(b.status === 'pending' || b.status === 'confirmed') &&
                          b.user_id === user.id && (
                          <button
                            onClick={() => handleCancel(b.id)}
                            className="btn btn--danger btn--sm"
                          >
                            Batalkan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
