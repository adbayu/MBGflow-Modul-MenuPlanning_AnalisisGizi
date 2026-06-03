# MBGflow— Menu Planning And Nutritioin Analysis (AI-Driven)

Sistem web untuk perencanaan menu dan kepatuhan gizi pada program Makan Bergizi Gratis (MBG 2.0). Dibangun untuk sekolah (SD/SMP), Posyandu, dan fasilitas kesehatan ibu.

## Ringkasan cepat

- Backend: Node.js + Express (port default: `3002`)
- Frontend: React + TypeScript + Vite (dev port: `5173`)
- Database: MySQL
- File upload: `backend/uploads/` (Multer)

## Prasyarat

- Node.js (v18+)
- npm
- MySQL (server berjalan)

## Menjalankan proyek (local)

1. Backend

```powershell
cd backend
npm install
cp .env.example .env   # sesuaikan konfigurasi DB dan GOOGLE_API_KEY
npm run setup-db      # buat tabel awal
npm start
```

2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Setelah kedua service berjalan: frontend akan terhubung ke backend (`http://localhost:3002`) untuk API.

## Variabel lingkungan penting (.env)

- `DB_HOST` — host MySQL
- `DB_USER` — user DB
- `DB_PASS` — password DB
- `DB_NAME` — nama database
- `PORT` — port backend (default 3002)
- `GOOGLE_API_KEY` — kunci untuk Google Generative AI (opsional, kalau fitur AI dipakai)

Contoh singkat (jangan commit kredensial):

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=secret
DB_NAME=mbg
PORT=3002
GOOGLE_API_KEY=ya29.xxxx
```

## Struktur proyek (singkat)

- `backend/` — Express server, route API, koneksi MySQL, upload, setup DB
- `frontend/` — React + Vite app, halaman utama, komponen, layanan
- `uploads/` — file image yang diunggah (backend)

Beberapa file penting:

- `backend/server.js` — entry point backend
- `backend/db.js` — pool MySQL
- `backend/setup-db.js` — inisialisasi schema
- `frontend/src/pages/DashboardPage.tsx` — halaman dashboard (besar, kandungan fitur banyak)

## Fitur utama

- Perpustakaan menu: CRUD menu makanan/minuman, upload gambar
- Perencana mingguan: drag-and-drop penjadwalan per lokasi
- Analisis komposisi piring: gabungkan sampai 3 menu, lihat makro/mikro
- Engine kepatuhan AKG: scoring terhadap target kelompok sasaran
- Integrasi AI: analisis nutrisi mendalam via Google Generative AI (opsional)

## Ringkasan endpoint API

- `GET /api/menu` — daftar menu
- `GET /api/menu/:id` — detail menu
- `POST /api/menu` — buat menu (multipart/form-data dengan gambar)
- `PUT /api/menu/:id` — update menu
- `DELETE /api/menu/:id` — hapus menu
- `POST /api/menu/analyze-plate` — analisis piring (AI)
- `GET /api/menu/weekly-plans` — ambil rencana mingguan
- `PUT /api/menu/weekly-plans` — simpan rencana mingguan
- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`

## Catatan pengembang

- `DashboardPage.tsx` cukup besar (~4300 baris). Pertimbangkan memecah komponen untuk maintainability.
- Weekly plans disimpan ke `localStorage` sebagai fallback dan juga disimpan ke MySQL (debounce).
- Hati-hati: beberapa file frontend menggunakan URL API hardcoded. Lebih baik gunakan `import.meta.env` / variabel lingkungan.
