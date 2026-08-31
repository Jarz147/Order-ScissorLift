import { useCallback, useEffect, useState } from 'react'
import { supabase, STORAGE_BUCKET } from '../../lib/supabase'

const statusLabel = {
  pending: 'Menunggu approval',
  confirmed: 'Dikonfirmasi',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  completed: 'Selesai',
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState([])
  const [docUrls, setDocUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('bookings')
      .select('*, lift:lifts(name, code), user:profiles(full_name)')
      .order('created_at', { ascending: false })
    if (error) {
      setError(error.message)
    } else {
      setBookings(data)
      const urls = {}
      await Promise.all(
        data
          .filter((b) => b.document_path)
          .map(async (b) => {
            const { data: signed } = await supabase.storage
              .from(STORAGE_BUCKET)
              .createSignedUrl(b.document_path, 3600)
            urls[b.id] = signed?.signedUrl
          }),
      )
      setDocUrls(urls)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('adminbookings-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => load(),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const handleStatus = async (id, status) => {
    setError('')
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    if (status === 'confirmed') {
      const target = bookings.find((b) => b.id === id)
      if (target) {
        await publishMqtt(target)
      }
    }
    load()
  }

  const publishMqtt = async (b) => {
    const { error } = await supabase.functions.invoke('publish-mqtt', {
      body: {
        event: 'booking_approved',
        lift: b.lift?.name,
        lift_code: b.lift?.code,
        user_name: b.user?.full_name,
        start_date: b.start_date,
        end_date: b.end_date,
      },
    })
    if (error) {
      setError('Pemesanan disetujui, tetapi gagal kirim ke MQTT: ' + error.message)
    }
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
      <h1>Semua Pemesanan</h1>
      {error && <div className="alert alert--error">{error}</div>}
      {bookings.length === 0 && <p className="muted">Belum ada pemesanan.</p>}
      <div className="list">
        {bookings.map((b) => (
          <div key={b.id} className="card">
            <div className="card__head">
              <h3>
                {b.lift?.name} <span className="badge badge--muted">{b.lift?.code}</span>
              </h3>
              <span className={`badge badge--${b.status}`}>{statusLabel[b.status]}</span>
            </div>
            <div className="card__meta">
              <span>Pemesan: {b.user?.full_name || 'Pengguna'}</span>
              <span>
                {new Date(b.start_date).toLocaleDateString('id-ID')} –{' '}
                {new Date(b.end_date).toLocaleDateString('id-ID')}
              </span>
            </div>
            {b.note && <p className="muted">{b.note}</p>}
            {b.document_path &&
              (docUrls[b.id] ? (
                <a
                  className="link"
                  href={docUrls[b.id]}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lihat dokumen terlampir
                </a>
              ) : (
                <span className="muted small">Dokumen terlampir</span>
              ))}
            <div className="card__actions">
              {b.status === 'pending' ? (
                <>
                  <button
                    onClick={() => handleStatus(b.id, 'confirmed')}
                    className="btn btn--primary btn--sm"
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => handleStatus(b.id, 'rejected')}
                    className="btn btn--danger btn--sm"
                  >
                    Tolak
                  </button>
                </>
              ) : (
                <select
                  value={b.status}
                  onChange={(e) => handleStatus(b.id, e.target.value)}
                  className="select"
                >
                  <option value="pending">Menunggu approval</option>
                  <option value="confirmed">Dikonfirmasi</option>
                  <option value="rejected">Ditolak</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="completed">Selesai</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
