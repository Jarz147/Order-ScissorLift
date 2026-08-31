# Scissor Lift Reservasi

Aplikasi web reservasi **scissor lift** dengan peran **admin** dan **user**. Dibangun dengan React + Vite, backend & autentikasi menggunakan **Supabase**, deploy ke **GitHub Pages**, dan integrasi **MQTT** (melalui Supabase Edge Function + Node-RED relay).

## Fitur

- Login/daftar dengan Supabase Auth (email & kata sandi)
- Dua peran: **admin** dan **user**
- **Admin**: tambah/ubah peran/hapus user, kelola scissor lift + upload gambar, **setujui/tolak semua pemesanan**, lihat semua pemesanan
- **User**: lihat daftar lift & log pemesanan semua user, buat pemesanan (harus disetujui admin), batalkan pemesanan sendiri, lampirkan dokumen
- **Satu lift = satu user sekaligus**: lift terkunci selama ada pemesanan `pending`/`confirmed` (dijaga di level database via EXCLUDE constraint)
- **Sinkronisasi real-time** antar user (Supabase Realtime)
- **Publish MQTT** otomatis saat pemesanan disetujui

---

## 1. Setup Supabase (database)

1. Buat project di https://supabase.com (tanpa template starter).
2. Buka **SQL Editor → New query**, salin **seluruh isi** `supabase/schema.sql`, lalu **Run**.
   Script membuat: tabel (`profiles`, `lifts`, `bookings`), trigger profil, fungsi admin, fungsi `is_admin()`, Row Level Security, EXCLUDE constraint anti-double-booking, bucket storage (`booking-documents`, `lift-images`), dan aktivasi Realtime.
3. Buat **akun admin pertama**:
   - Daftar via halaman Register aplikasi (atau Authentication → Users).
   - Salin **ID user** dari Authentication → Users.
   - Jalankan di SQL Editor:
     ```sql
     update public.profiles set role = 'admin' where id = 'ID_USER_ANDA';
     ```
4. Untuk meng-upload gambar & dokumen, bucket sudah dibuat otomatis. Jika perlu verifikasi: **Storage → Buckets** harus ada `booking-documents` (private) dan `lift-images` (public).

> Jika Anda sudah pernah menjalankan script dan ada error, jalankan ulang `schema.sql` yang terbaru — seluruh perintah idempotent (aman dijalankan berulang).

---

## 2. Konfigurasi lingkungan (lokal)

```bash
cp .env.example .env
```

Isi `.env` dengan nilai dari **Project Settings → API**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Jalankan:
```bash
npm install
npm run dev
```

> Jangan commit `.env` (sudah di `.gitignore`).

---

## 3. Deploy ke GitHub Pages

1. Push kode ke repositori GitHub (mis. `Order-ScissorLift`).
2. Di **Settings → Secrets and variables → Actions** tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Di **Settings → Pages → Source** pilih **GitHub Actions**.
4. Pastikan `const repo = '...'` di `vite.config.js` sama dengan nama repositori.
5. Push ke `main` — workflow `.github/workflows/deploy.yml` build & deploy otomatis.

Live di: `https://<USERNAME>.github.io/<REPO>/`

> Aplikasi memakai **HashRouter**, jadi refresh halaman dalam tidak akan 404.

---

## 4. Setup MQTT (saat pemesanan disetujui → publish ke broker)

Arsitektur:
```
Admin klik "Setujui"
  → Supabase update status → confirmed
  → Edge Function publish-mqtt (cloud)
  → HTTP POST ke Node-RED (via ngrok/tunnel)
  → Node-RED publish MQTT ke broker 192.168.137.188 (user sdi4.0)
```

### 4a. Deploy Edge Function
```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set NODERED_URL=https://<ngrok-url>.ngrok-free.app/scissor/approve
supabase secrets set NODERED_TOKEN=SDI_RELAY_TOKEN
supabase functions deploy publish-mqtt
```
> `<PROJECT_REF>` = subdomain project Anda (mis. `ztskdjnaghcsnptwotwy`).

### 4b. Import flow Node-RED
1. Buka Node-RED → **Menu → Import**, tempel isi `supabase/nodered-mqtt-relay.json` → **Deploy**.
2. Flow berisi: HTTP-in `POST /scissor/approve` → validasi token → MQTT-out ke broker `192.168.137.188:1883`, topic `scissor/lift/status`.
3. Pastikan broker tersebut bisa diakses dari mesin Node-RED.

### 4c. Ekspos Node-RED ke internet
Karena Edge Function berjalan di cloud (tidak bisa akses IP LAN), Node-RED harus punya URL public. Cara termudah: **ngrok**.
```bash
ngrok http 1880
```
Salin URL `https://xxxx.ngrok-free.app`, pakai untuk `NODERED_URL` (tambah `/scissor/approve`).

### 4d. Catatan
- Token di Node-RED (`SDI_RELAY_TOKEN`) **harus sama** dengan `NODERED_TOKEN` Edge Function.
- Payload ke broker (topic `scissor/lift/status`):
  ```json
  {"event":"booking_approved","lift":"...","pemesan":"...","mulai":"...","selesai":"...","status":"aktif"}
  ```

---

## Struktur Proyek

```
scissor-lift-app/
├─ supabase/
│  ├─ schema.sql                     # schema + RLS + fungsi + storage + realtime
│  ├─ nodered-mqtt-relay.json        # flow Node-RED relay MQTT
│  └─ functions/publish-mqtt/        # Edge Function publish ke MQTT
├─ .github/workflows/deploy.yml      # CI/CD GitHub Pages
├─ src/
│  ├─ lib/supabase.js                # client Supabase
│  ├─ context/AuthContext.jsx        # state login & profil
│  ├─ components/                    # Layout, ProtectedRoute, AdminRoute
│  └─ pages/
│     ├─ Login.jsx / Register.jsx
│     ├─ Dashboard.jsx               # daftar lift + log pemesanan semua user
│     ├─ Booking.jsx                 # buat pemesanan + lampir dokumen
│     └─ admin/                      # kelola user, lift, semua pemesanan
```
