import { useCallback, useEffect, useState } from 'react'
import { supabase, STORAGE_BUCKET } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const statusLabel = {
  confirmed: 'Dikonfirmasi',
  cancelled: 'Dibatalkan',
  completed: 'Selesai',
}

export default function MyBookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [docUrls, setDocUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('bookings')
      .select('*, lift:lifts(name, code)')
      .eq('user_id', user.id)
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
  }, [user.id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('mybookings-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => load(),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const handleCancel = async (id) => {
    if (!window.confirm('Batalkan pemesanan ini?')) return
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    load()
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
      <h1>Pemesanan Saya</h1>
      {error && <div className="alert alert--error">{error}</div>}
      {bookings.length === 0 && <p className="muted">Belum ada pemesanan.</p>}
      <div className="list">
        {bookings.map((b) => (
          <div key={b.id} className="card">
            <div className="card__head">
              <h3>{b.lift?.name || 'Scissor lift'}</h3>
              <span className={`badge badge--${b.status}`}>{statusLabel[b.status]}</span>
            </div>
            <div className="card__meta">
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
            {b.status === 'confirmed' && (
              <div className="card__actions">
                <button onClick={() => handleCancel(b.id)} className="btn btn--danger">
                  Batalkan
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
