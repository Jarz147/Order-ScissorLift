import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Register() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data?.session) {
      navigate('/dashboard')
    } else {
      setError(
        'Pendaftaran berhasil. Silakan cek email Anda untuk konfirmasi sebelum masuk.',
      )
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={handleSubmit}>
        <h1>Daftar Akun</h1>
        <p className="muted">Akun baru otomatis berperan sebagai user.</p>
        {error && <div className="alert alert--info">{error}</div>}
        <label>
          Nama lengkap
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Kata sandi
          <input
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Memproses...' : 'Daftar'}
        </button>
        <p className="muted">
          Sudah punya akun?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login') }}>
            Masuk
          </a>
        </p>
      </form>
    </div>
  )
}
