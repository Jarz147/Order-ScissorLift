-- =====================================================================
--  SCISSOR LIFT RESERVASI - Supabase Schema
--  Jalankan seluruh file ini di: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

-- 1) Ekstensi untuk EXCLUDE constraint (cegah double booking)
create extension if not exists btree_gist;

-- 2) Tabel PROFILES (relasi 1-1 dengan auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- 3) Tabel LIFTS (scissor lift)
create table if not exists public.lifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  capacity_kg numeric,
  description text,
  image_url text,
  status text not null default 'available' check (status in ('available', 'maintenance')),
  created_at timestamptz not null default now()
);

-- tambahkan kolom image_url bila belum ada (untuk tabel yang sudah dibuat)
alter table public.lifts add column if not exists image_url text;

-- 4) Tabel BOOKINGS
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  lift_id uuid not null references public.lifts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  note text,
  document_path text,           -- path file di Storage bucket
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- 5) Perbarui CHECK constraint status (untuk tabel yang sudah ada)
alter table public.bookings
  drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed'));

-- 6) CEGAH DOUBLE BOOKING (level database)
--    Aturan: SATU LIFT = SATU USER SEKALIGUS.
--    Lift terkunci (hanya boleh ada 1 booking aktif per lift) selama
--    statusnya 'pending' (menunggu approval admin) atau 'confirmed'.
--    Lift baru bisa dipesan lagi setelah booking itu diselesaikan/ditolak/dibatalkan.
alter table public.bookings
  drop constraint if exists bookings_no_overlap;
alter table public.bookings
  drop constraint if exists bookings_single_confirmed;
alter table public.bookings
  add constraint bookings_single_confirmed
  exclude using gist (
    lift_id with =
  ) where (status in ('pending', 'confirmed'));

-- 6) Index pendukung
create index if not exists bookings_lift_date_idx on public.bookings (lift_id, start_date, end_date);
create index if not exists bookings_user_idx on public.bookings (user_id);

-- 7) AKTIFKAN REALTIME agar perubahan data tersinkron antar user
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lifts'
  ) then
    alter publication supabase_realtime add table public.lifts;
  end if;
end $$;

-- 7) TRIGGER: buat baris profiles otomatis saat user baru terdaftar
--    (berlaku baik untuk self-register maupun admin_create_user)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================================
--  FUNGSI ADMIN (dijalankan client-side; security definer)
--  Menggunakan service role agar bisa membuat/menghapus user auth.
-- =====================================================================

-- Admin menambah user baru
create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text default 'user'
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_id uuid;
begin
  -- hanya admin yang boleh memanggil
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Hanya admin yang dapat menambah user';
  end if;

  if p_role not in ('user', 'admin') then
    raise exception 'Role tidak valid';
  end if;

  select id into new_id
  from auth.admin.create_user(
    email => p_email,
    password => p_password,
    email_confirm => true,
    user_metadata => jsonb_build_object('full_name', p_full_name)
  );

  update public.profiles set role = p_role where id = new_id;
  return new_id;
end;
$$;

-- Admin menghapus user
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Hanya admin yang dapat menghapus user';
  end if;

  delete from auth.users where id = p_user_id;  -- cascade ke profiles & bookings
end;
$$;

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
-- Helper untuk cek admin. Security definer => dijalankan sebagai owner
-- (postgres), sehingga MEMBYPASS RLS dan TIDAK menimbulkan rekursi.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

alter table public.profiles enable row level security;
alter table public.lifts enable row level security;
alter table public.bookings enable row level security;

-- Bersihkan policy LAMA yang memakai subquery rekursif (jika pernah dibuat)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "bookings_select_own_or_admin" on public.bookings;
drop policy if exists "bookings_update_own_or_admin" on public.bookings;
drop policy if exists "bookings_update_own" on public.bookings;
drop policy if exists "bookings_update_admin" on public.bookings;

-- PROFILES
-- select: user bisa baca dirinya sendiri (policy terpisah), admin baca semua
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- select: semua user login boleh melihat profil (untuk menampilkan nama pemesan di log)
drop policy if exists "profiles_select_auth" on public.profiles;
create policy "profiles_select_auth" on public.profiles
  for select using (auth.role() = 'authenticated');

-- update: user bisa ubah dirinya sendiri, admin ubah semua
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- (INSERT dikelola oleh trigger handle_new_user dan fungsi security definer)

-- LIFTS
drop policy if exists "lifts_select_auth" on public.lifts;
create policy "lifts_select_auth" on public.lifts
  for select using (auth.role() = 'authenticated');

drop policy if exists "lifts_admin_insert" on public.lifts;
create policy "lifts_admin_insert" on public.lifts
  for insert with check (public.is_admin());

drop policy if exists "lifts_admin_update" on public.lifts;
create policy "lifts_admin_update" on public.lifts
  for update using (public.is_admin());

drop policy if exists "lifts_admin_delete" on public.lifts;
create policy "lifts_admin_delete" on public.lifts
  for delete using (public.is_admin());

-- BOOKINGS
-- select: semua user yang login BISA melihat seluruh log pemesanan
drop policy if exists "bookings_select_own" on public.bookings;
drop policy if exists "bookings_select_admin" on public.bookings;
drop policy if exists "bookings_select_all" on public.bookings;
create policy "bookings_select_all" on public.bookings
  for select using (auth.role() = 'authenticated');

drop policy if exists "bookings_insert_auth" on public.bookings;
create policy "bookings_insert_auth" on public.bookings
  for insert with check (auth.uid() = user_id);

-- user hanya boleh membatalkan booking miliknya (ubah status jadi 'cancelled')
drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_update_own" on public.bookings
  for update using (auth.uid() = user_id)
  with check (status = 'cancelled');

-- admin boleh mengubah status apa pun (setujui/tolak/selesaikan/batalkan)
drop policy if exists "bookings_update_admin" on public.bookings;
create policy "bookings_update_admin" on public.bookings
  for update using (public.is_admin());

-- =====================================================================
--  STORAGE BUCKET untuk dokumen lampiran
--  Jalankan bagian ini DI SINI (perlu izin admin dashboard),
--  atau buat manual di: Storage > New bucket "booking-documents"
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('booking-documents', 'booking-documents', false)
on conflict (id) do nothing;

-- siapa pun yang login boleh mengunggah dokumen
drop policy if exists "doc_upload_auth" on storage.objects;
create policy "doc_upload_auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'booking-documents');

-- pembaca: hanya pemilik path (folder user id) atau admin
drop policy if exists "doc_read_owner_or_admin" on storage.objects;
create policy "doc_read_owner_or_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'booking-documents' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- =====================================================================
--  STORAGE BUCKET untuk gambar scissor lift (public)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('lift-images', 'lift-images', true)
on conflict (id) do nothing;

-- hanya admin yang boleh mengunggah gambar lift
drop policy if exists "liftimg_upload_admin" on storage.objects;
create policy "liftimg_upload_admin" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'lift-images' and public.is_admin()
  );

-- pembaca publik boleh melihat gambar lift
drop policy if exists "liftimg_read_public" on storage.objects;
create policy "liftimg_read_public" on storage.objects
  for select to authenticated using (bucket_id = 'lift-images');
-- izin baca publik untuk anon (biasanya otomatis karena bucket public)
drop policy if exists "liftimg_read_anon" on storage.objects;
create policy "liftimg_read_anon" on storage.objects
  for select to anon using (bucket_id = 'lift-images');

-- =====================================================================
--  JADIKAN DIRI ANDA ADMIN PERTAMA
--  1) Daftarkan akun Anda lewat halaman Register (atau buat di
--     Authentication > Users).
--  2) Ganti [USER-ID-ANDA] di bawah dengan ID user Anda lalu jalankan:
-- =====================================================================
-- update public.profiles
-- set role = 'admin'
-- where id = '[USER-ID-ANDA]';
