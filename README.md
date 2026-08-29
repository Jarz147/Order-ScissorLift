# Scissor Lift Reservasi

Aplikasi web reservasi **scissor lift** dengan peran **admin** dan **user**. Dibangun dengan React + Vite, backend & autentikasi menggunakan **Supabase**, dan di-deploy ke **GitHub Pages**.

## Fitur

- Login/daftar dengan Supabase Auth (email & kata sandi)
- Dua peran: **admin** dan **user**
- **Admin** dapat: menambah user, mengubah peran user, menghapus user, menambah/mengubah/menghapus scissor lift, melihat semua pemesanan
- **User** dapat: melihat daftar lift & ketersediaan, membuat pemesanan, membatalkan pemesanan, melihat riwayat pemesanan sendiri
- **Anti double booking**: satu lift tidak bisa dipesan pada rentang tanggal yang bertabrakan (dijaga di level database via EXCLUDE constraint)
- **Lampiran dokumen** per pemesanan (Supabase Storage)

---

## 1. Setup Supabase

1. Buat project baru di https://supabase.com (jangan pakai template starter).
2. Buka **SQL Editor** → New query, salin seluruh isi `supabase/schema.sql`, lalu **Run**. Ini membuat tabel, trigger, fungsi admin, Row Level Security, bucket storage, dan constraint anti-double-booking.
3. Buat **akun admin pertama**:
   - Daftarkan akun Anda via halaman **Register** aplikasi (atau tambah user di **Authentication → Users**).
   - Salin **ID user** Anda dari Authentication → Users.
   - Jalankan query ini di SQL Editor (ganti `ID_USER_ANDA`):
     ```sql
     update public.profiles
     set role = 'admin'
     where id = 'ID_USER_ANDA';
     ```
4. **Storage bucket** `booking-documents` sudah dibuat otomatis oleh script. Jika tidak, buat manual: **Storage → New bucket** dengan nama `booking-documents`, visibility **private**.

## 2. Konfigurasi lingkungan (lokal)

```bash
cp .env.example .env
```

Isi `.env` dengan nilai dari **Project Settings → API**:
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = anon/public key

Jalankan:
```bash
npm install
npm run dev
```

> Jangan pernah commit `.env` (sudah masuk `.gitignore`).

## 3. Deploy ke GitHub Pages

1. Buat repositori GitHub baru dan push kode:
   ```bash
   git init
   git add .
   git commit -m "Scissor lift reservasi"
   git branch -M main
   git remote add origin https://github.com/<USERNAME>/<REPO>.git
   git push -u origin main
   ```
2. Di GitHub repo → **Settings → Secrets and variables → Actions**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Di **Settings → Pages → Source**, pilih **GitHub Actions**.
4. Ubah nama repo di `vite.config.js` (baris `const repo = '...'`) agar cocok dengan nama repo Anda.
5. Push lagi (atau push apa pun ke `main`) — workflow `.github/workflows/deploy.yml` akan build & deploy otomatis.

Aplikasi akan live di: `https://<USERNAME>.github.io/<REPO>/`

---

## Struktur Proyek

```
scissor-lift-app/
├─ supabase/schema.sql          # schema + RLS + fungsi admin + storage
├─ .github/workflows/deploy.yml # CI/CD GitHub Pages
├─ src/
│  ├─ lib/supabase.js           # client Supabase
│  ├─ context/AuthContext.jsx   # state login & profil
│  ├─ components/               # Layout, ProtectedRoute, AdminRoute
│  └─ pages/
│     ├─ Login.jsx / Register.jsx
│     ├─ Dashboard.jsx          # daftar lift & ketersediaan
│     ├─ Booking.jsx            # buat pemesanan + lampir dokumen
│     ├─ MyBookings.jsx         # riwayat pemesanan user
│     └─ admin/                 # kelola user, lift, semua pemesanan
```
