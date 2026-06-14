# Analisis Test Case Aplikasi Menu Planning

## 1. Ringkasan Hasil Analisis Repo

- Framework yang digunakan:
  - Backend menggunakan Node.js + Express.
  - Frontend menggunakan React + TypeScript + Vite.
  - Database menggunakan MySQL.
- Fitur utama yang ditemukan:
  - Autentikasi login dan logout.
  - Dashboard ringkasan menu dan nutrisi.
  - Katalog menu dengan pencarian, filter kategori, filter jenis menu, analisis AI, edit, dan hapus menu.
  - Recipe Builder untuk tambah dan edit menu, termasuk data bahan, nutrisi, kategori sasaran, jenis menu, porsi, dan gambar opsional.
  - Analisis komposisi piring atau Piringku dari beberapa menu.
  - Jadwal menu mingguan per lokasi distribusi, termasuk pemilihan lokasi dan simpan jadwal.
  - AI Menu Generator berbasis bahan tersedia.
- Role pengguna:
  - Tabel `users` memiliki field `role`.
  - Login mengembalikan role pengguna, dengan default tampilan `Ahli Gizi` jika role kosong.
  - Tidak ditemukan pembatasan akses halaman berdasarkan role di frontend atau middleware role khusus di backend.
- Modul yang layak diuji:
  - Autentikasi.
  - Dashboard.
  - Katalog menu.
  - Recipe Builder atau kelola menu.
  - Analisis AI nutrisi.
  - Piringku.
  - Jadwal menu mingguan.
  - Logout.
- Asumsi penting:
  - Data user dari seed tersedia, misalnya username `admin` dan password sesuai data seed database.
  - Backend berjalan di port `3002` dan frontend berjalan di port `5173`.
  - Beberapa fitur AI membutuhkan konfigurasi `GOOGLE_API_KEY`; jika belum tersedia, pengujian difokuskan pada respons error yang tampil di UI.
  - Untuk test edit, hapus, Piringku, dan jadwal, data menu dummy harus tersedia terlebih dahulu.

## 2. Prioritas Pengujian

1. Autentikasi pengguna.
2. Dashboard dan navigasi utama.
3. Manajemen katalog menu.
4. Tambah, edit, dan hapus menu melalui Recipe Builder dan Menu Catalog.
5. Validasi form menu.
6. Analisis nutrisi AI.
7. Piringku atau analisis kombinasi menu.
8. Jadwal menu mingguan per lokasi distribusi.
9. Logout.

## 3. Test Case

## 3.1 Autentikasi

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Login | TC_AUTH_001_Login_Valid | Pengguna login menggunakan kredensial valid | Frontend dan backend berjalan; user aktif tersedia | 1. Buka halaman login<br>2. Isi username valid<br>3. Isi password valid<br>4. Klik tombol login | - username = admin<br>- password = sesuai seed database | Login berhasil; pengguna diarahkan ke dashboard; nama dan role tampil |
| Login | TC_AUTH_002_Login_Invalid | Pengguna login menggunakan username/password salah | Pengguna berada pada halaman login | 1. Buka halaman login<br>2. Isi username valid/tidak terdaftar<br>3. Isi password salah<br>4. Klik tombol login | - username = admin<br>- password = salah123 | Login gagal; pengguna tetap di halaman login; pesan error tampil |
| Login | TC_AUTH_003_Login_Username_Kosong | Pengguna login tanpa username | Pengguna berada pada halaman login | 1. Buka halaman login<br>2. Kosongkan username<br>3. Isi password<br>4. Klik tombol login | - username = kosong<br>- password = sesuai seed database | Login gagal; pesan validasi username wajib diisi tampil |
| Login | TC_AUTH_004_Login_Password_Kosong | Pengguna login tanpa password | Pengguna berada pada halaman login | 1. Buka halaman login<br>2. Isi username valid<br>3. Kosongkan password<br>4. Klik tombol login | - username = admin<br>- password = kosong | Login gagal; pesan validasi password wajib diisi tampil |

## 3.2 Dashboard dan Navigasi

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Dashboard | TC_DASHBOARD_001_Lihat_Dashboard | Pengguna melihat dashboard setelah login | Pengguna sudah login | 1. Login dengan akun valid<br>2. Amati halaman awal<br>3. Periksa ringkasan menu, nutrisi, dan jadwal | - | Dashboard tampil lengkap tanpa error UI |
| Dashboard | TC_DASHBOARD_002_Cari_Menu_Dashboard | Pengguna mencari menu dari kolom pencarian dashboard | Pengguna berada pada dashboard; data menu tersedia | 1. Klik kolom pencarian menu/dashboard<br>2. Isi kata kunci menu<br>3. Amati hasil yang tampil | - keyword = nasi | Hasil pencarian/filter tampil sesuai kata kunci |
| Navigasi | TC_DASHBOARD_003_Navigasi_Menu_Utama | Pengguna berpindah halaman melalui sidebar | Pengguna sudah login | 1. Klik `Dashboard`<br>2. Klik `Weekly Schedule`<br>3. Klik `Menu Catalog`<br>4. Klik `Recipe Builder`<br>5. Klik `AI Nutrition Lab` | - | Setiap menu membuka halaman sesuai pilihan tanpa logout/error |
| Navigasi | TC_DASHBOARD_004_Toggle_Theme | Pengguna mengubah mode tampilan | Pengguna sudah login | 1. Klik tombol toggle tema siang/malam<br>2. Amati perubahan warna tampilan<br>3. Refresh halaman | - | Tema berubah dan tetap tersimpan setelah refresh |

## 3.3 Menu Catalog

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Menu Catalog | TC_MENU_001_Lihat_Daftar_Menu | Pengguna melihat daftar menu pada katalog | Pengguna sudah login; data menu tersedia | 1. Klik `Menu Catalog`<br>2. Amati daftar menu<br>3. Periksa nama, kategori, jenis, porsi, dan nutrisi ringkas | - | Daftar menu tampil; total data tampil; informasi utama menu terlihat |
| Menu Catalog | TC_MENU_002_Cari_Menu_Valid | Pengguna mencari menu yang tersedia | Pengguna berada pada `Menu Catalog` | 1. Klik kolom pencarian<br>2. Isi keyword menu yang ada<br>3. Amati daftar menu | - keyword = nasi | Daftar terfilter sesuai keyword |
| Menu Catalog | TC_MENU_003_Cari_Menu_Tidak_Ditemukan | Pengguna mencari menu yang tidak tersedia | Pengguna berada pada `Menu Catalog` | 1. Klik kolom pencarian<br>2. Isi keyword acak<br>3. Amati hasil pencarian | - keyword = zzzTidakAda999 | Pesan data kosong/tidak ditemukan tampil |
| Menu Catalog | TC_MENU_004_Filter_Kategori_Jenis | Pengguna memfilter menu berdasarkan kategori dan jenis | Pengguna berada pada `Menu Catalog`; data menu tersedia | 1. Klik tab `Siswa`<br>2. Klik tab `Balita`<br>3. Klik tab `Ibu Hamil`<br>4. Klik tab `Makanan`<br>5. Klik tab `Minuman` | - | Daftar berubah sesuai filter; total data menyesuaikan |

## 3.4 Kelola Menu / Recipe Builder

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Tambah Menu | TC_MENU_005_Tambah_Menu_Valid | Pengguna menambahkan menu baru dengan data valid | Pengguna sudah login dan berada pada `Menu Catalog` | 1. Klik `Tambah Menu`<br>2. Isi `Nama Menu`<br>3. Pilih kategori sasaran<br>4. Pilih jenis menu<br>5. Pilih porsi<br>6. Isi bahan, jumlah, satuan, harga<br>7. Isi nutrisi utama<br>8. Klik `Simpan Menu` | - nama = Menu Test Katalon 001<br>- kategori = Siswa<br>- jenis = Makanan<br>- porsi = Porsi Besar<br>- bahan = Beras, Ayam<br>- kalori = 500<br>- protein = 25 | Menu berhasil disimpan; pesan sukses tampil; menu muncul di katalog |
| Tambah Menu | TC_MENU_006_Tambah_Menu_Nama_Kosong | Pengguna menyimpan menu tanpa nama | Pengguna berada pada `Recipe Builder` mode tambah | 1. Kosongkan `Nama Menu`<br>2. Pilih kategori<br>3. Isi bahan/nutrisi minimal<br>4. Klik `Simpan Menu` | - nama = kosong<br>- kategori = Siswa | Menu tidak tersimpan; pesan validasi nama wajib diisi tampil |
| Tambah Menu | TC_MENU_007_Tambah_Menu_Kategori_Kosong | Pengguna menyimpan menu tanpa kategori sasaran | Pengguna berada pada `Recipe Builder` mode tambah | 1. Isi `Nama Menu`<br>2. Kosongkan/tidak pilih kategori jika UI memungkinkan<br>3. Isi bahan/nutrisi minimal<br>4. Klik `Simpan Menu` | - nama = Menu Tanpa Kategori<br>- kategori = kosong | Menu tidak tersimpan atau kategori default tervalidasi; error/indikator kategori tampil bila wajib |
| Tambah Menu | TC_MENU_008_Tambah_Menu_Data_Nutrisi_Kosong | Pengguna menyimpan menu tanpa nilai nutrisi | Pengguna berada pada `Recipe Builder` mode tambah | 1. Isi nama menu<br>2. Pilih kategori<br>3. Kosongkan nilai nutrisi utama<br>4. Klik `Simpan Menu` | - kalori = kosong<br>- protein = kosong<br>- lemak = kosong<br>- karbohidrat = kosong | Sistem menolak input kosong bila wajib, atau menyimpan nilai 0 sesuai perilaku aplikasi; hasil terlihat di UI |
| Edit Menu | TC_MENU_009_Edit_Menu_Valid | Pengguna mengubah data menu yang sudah ada | Data menu test tersedia di katalog | 1. Buka `Menu Catalog`<br>2. Klik icon/tombol `Edit` pada menu test<br>3. Ubah nama/deskripsi/nutrisi<br>4. Klik `Perbarui Menu` | - nama baru = Menu Test Katalon Updated | Data berhasil diperbarui; pesan sukses/log perubahan tampil; perubahan muncul di katalog |
| Edit Menu | TC_MENU_010_Edit_Menu_Batal | Pengguna membatalkan proses edit menu | Pengguna berada pada mode edit menu | 1. Buka menu dalam mode edit<br>2. Ubah salah satu field<br>3. Klik tombol batal/kembali ke katalog<br>4. Buka kembali menu tersebut | - | Perubahan tidak tersimpan; data lama tetap tampil |
| Hapus Menu | TC_MENU_011_Hapus_Menu_Batal | Pengguna membatalkan hapus menu | Data menu test tersedia di katalog | 1. Klik icon/tombol `Hapus`<br>2. Modal konfirmasi tampil<br>3. Klik batal/tutup modal | - menu = Menu Test Katalon Updated | Modal tertutup; menu tetap ada di daftar |
| Hapus Menu | TC_MENU_012_Hapus_Menu_Konfirmasi | Pengguna menghapus menu dari katalog | Data menu test tersedia di katalog | 1. Klik icon/tombol `Hapus`<br>2. Pada modal `Konfirmasi Hapus Menu`, klik `Ya, Hapus Menu` | - menu = Menu Test Katalon Updated | Menu berhasil dihapus dan hilang dari daftar |

## 3.5 Analisis Nutrisi AI

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Analisis AI | TC_NUTRITION_001_Analisis_AI_Menu_Valid | Pengguna menjalankan analisis AI pada menu | Data menu tersedia; backend berjalan | 1. Buka `Menu Catalog`<br>2. Pilih salah satu menu<br>3. Klik `Analisis AI`<br>4. Tunggu proses selesai | - menu = salah satu menu aktif | Hasil analisis nutrisi tampil, atau pesan error AI tampil jika API key belum tersedia |
| Analisis AI | TC_NUTRITION_002_Lihat_Analisis_Tersimpan | Pengguna melihat hasil analisis yang sudah pernah dibuat | Menu memiliki status `Analisis AI tersimpan` | 1. Buka `Menu Catalog`<br>2. Pilih menu dengan analisis tersimpan<br>3. Klik `Lihat Analisis` | - | Panel analisis tersimpan tampil tanpa membuat data menu baru |
| AI Generator | TC_NUTRITION_003_Generate_Menu_AI_Valid | Pengguna membuat rekomendasi menu dari bahan tersedia | Pengguna berada pada `Recipe Builder`; backend berjalan | 1. Isi bahan tersedia di panel `AI Menu Generator`<br>2. Pilih target/kategori jika tersedia<br>3. Klik `Generate Menu dengan AI` | - bahan = Beras, Ayam, Wortel<br>- kategori = Siswa | Hasil rekomendasi AI tampil dan form menu terisi, atau pesan error tampil jika AI belum dikonfigurasi |
| AI Generator | TC_NUTRITION_004_Generate_Menu_AI_Input_Kosong | Pengguna generate AI tanpa bahan | Pengguna berada pada `Recipe Builder` | 1. Kosongkan bahan tersedia pada panel AI<br>2. Klik `Generate Menu dengan AI` | - bahan = kosong | Generate tidak diproses atau pesan validasi/error tampil di UI |

## 3.6 Piringku

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Piringku | TC_PLATE_001_Tambah_Menu_Ke_Piringku | Pengguna menambahkan menu ke komposisi Piringku | Pengguna sudah login; data menu tersedia | 1. Buka `Dashboard`<br>2. Cari menu pada panel menu<br>3. Klik/drag menu ke area `Piringku` atau klik `Tambahkan Menu`<br>4. Pilih menu dari modal `Pilih Menu Piringku` | - menu = salah satu menu aktif | Menu masuk ke area Piringku; ringkasan nutrisi diperbarui |
| Piringku | TC_PLATE_002_Tambah_Menu_Maksimal | Pengguna mencoba menambahkan menu melebihi batas komposisi | Area Piringku sudah berisi batas maksimal menu sesuai UI | 1. Tambahkan beberapa menu ke Piringku sampai batas maksimal<br>2. Tambahkan menu berikutnya<br>3. Amati respons UI | - menu = beberapa menu aktif | Sistem membatasi penambahan atau menampilkan pesan/perilaku sesuai batas UI |
| Piringku | TC_PLATE_003_Filter_Menu_Piringku | Pengguna mencari dan memfilter menu pada modal Piringku | Modal `Pilih Menu Piringku` terbuka | 1. Klik `Tambahkan Menu`<br>2. Isi keyword pencarian<br>3. Pilih filter target bila tersedia<br>4. Amati daftar menu | - keyword = ayam<br>- filter = target | Daftar menu pada modal terfilter sesuai keyword/filter |
| Piringku | TC_PLATE_004_Analisis_Komposisi_Piringku | Pengguna menganalisis kombinasi menu Piringku | Area Piringku berisi minimal satu menu | 1. Pastikan menu masuk ke Piringku<br>2. Klik tombol analisis/lihat hasil nutrisi Piringku jika tersedia<br>3. Amati skor/status/rekomendasi nutrisi | - | Hasil analisis komposisi piring tampil; skor/status nutrisi terlihat |

## 3.7 Jadwal Menu Mingguan

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Jadwal Mingguan | TC_PLAN_001_Pilih_Lokasi_Distribusi | Pengguna memilih lokasi distribusi | Pengguna sudah login; lokasi tersedia | 1. Klik `Weekly Schedule`<br>2. Klik `Lokasi Distribusi`<br>3. Pilih salah satu lokasi | - lokasi = salah satu lokasi tersedia | Lokasi aktif berubah; informasi penerima lokasi tampil |
| Jadwal Mingguan | TC_PLAN_002_Filter_Periode_Jadwal | Pengguna memilih periode/minggu jadwal | Pengguna berada pada `Weekly Schedule` | 1. Buka modal/periode jadwal<br>2. Pilih bulan/periode minggu<br>3. Gunakan pencarian/filter status jika tersedia | - bulan = bulan berjalan<br>- status = Semua | Jadwal menampilkan minggu/periode sesuai pilihan |
| Jadwal Mingguan | TC_PLAN_003_Susun_Jadwal_Mingguan | Pengguna menyusun jadwal Senin-Sabtu | Lokasi distribusi dipilih; data menu tersedia | 1. Cari menu pada panel menu<br>2. Drag menu ke salah satu hari jadwal<br>3. Ulangi untuk beberapa hari<br>4. Amati kartu hari | - menu = beberapa menu aktif<br>- hari = Senin-Sabtu | Menu masuk ke hari yang dipilih; jadwal menampilkan menu terkait |
| Jadwal Mingguan | TC_PLAN_004_Simpan_Jadwal_Konfirmasi | Pengguna menyimpan jadwal mingguan | Jadwal memiliki minimal satu menu | 1. Klik `Simpan Jadwal Mingguan`<br>2. Pada modal `Simpan Jadwal?`, klik `Simpan`<br>3. Tunggu proses selesai | - | Pesan/status simpan berhasil tampil; jadwal tetap ada setelah refresh/buka ulang |
| Jadwal Mingguan | TC_PLAN_005_Simpan_Jadwal_Batal | Pengguna membatalkan simpan jadwal | Jadwal memiliki perubahan belum disimpan | 1. Klik `Simpan Jadwal Mingguan`<br>2. Pada modal `Simpan Jadwal?`, klik batal/tutup modal | - | Modal tertutup; proses simpan tidak dijalankan; pengguna tetap di halaman jadwal |
| Jadwal Mingguan | TC_PLAN_006_Cari_Menu_Jadwal_Tidak_Ditemukan | Pengguna mencari menu yang tidak tersedia saat menyusun jadwal | Pengguna berada pada `Weekly Schedule` | 1. Klik pencarian menu jadwal<br>2. Isi keyword acak<br>3. Amati daftar menu | - keyword = zzzTidakAda999 | Daftar menu kosong atau pesan tidak ditemukan tampil |

## 3.8 Logout

| Fungsionalitas | ID Test Case | Deskripsi/Skenario | Pra Kondisi | Langkah Pengujian | Data Pengujian | Hasil yang Diharapkan |
|---|---|---|---|---|---|---|
| Logout | TC_AUTH_005_Logout_Valid | Pengguna keluar dari aplikasi | Pengguna sudah login | 1. Klik tombol `Logout` pada sidebar<br>2. Amati halaman setelah logout | - | Session lokal dihapus; pengguna diarahkan ke halaman login |
| Logout | TC_AUTH_006_Akses_Setelah_Logout | Pengguna mencoba mengakses aplikasi setelah logout | Pengguna sudah logout | 1. Logout dari aplikasi<br>2. Refresh halaman<br>3. Coba buka halaman utama aplikasi | - | Pengguna tetap diarahkan ke halaman login; dashboard tidak tampil tanpa login |

## 4. Catatan untuk Pengujian di Katalon Studio

- Test case ini cocok direkam menggunakan fitur Record Web karena seluruh skenario berbasis aksi UI browser.
- Pastikan backend, frontend, dan database aktif sebelum mulai record.
- Pastikan data dummy user, menu, nutrisi, dan lokasi distribusi tersedia sebelum pengujian.
- Untuk skenario edit dan hapus, buat data khusus terlebih dahulu agar tidak menghapus data seed penting.
- Gunakan nama data unik, misalnya `Menu Test Katalon 001`, agar tidak bentrok saat pengujian berulang.
- Untuk skenario validasi kosong, catat apakah aplikasi menampilkan pesan validasi frontend atau pesan error dari backend.
- Untuk skenario AI, siapkan `GOOGLE_API_KEY` jika ingin menguji hasil sukses penuh.
- Jika AI belum dikonfigurasi, validasi UI tetap dapat dilakukan dengan mengecek pesan error yang tampil.
- Jika terdapat session/localStorage, lakukan record dari awal login agar state aplikasi konsisten.
- Untuk fitur drag-and-drop jadwal/Piringku, gunakan mode Record Web lalu koreksi object locator jika Katalon tidak menangkap event drag secara stabil.

## 5. Rekomendasi Urutan Eksekusi Test Case

1. TC_AUTH_001_Login_Valid.
2. TC_AUTH_002_Login_Invalid.
3. TC_AUTH_003_Login_Username_Kosong.
4. TC_AUTH_004_Login_Password_Kosong.
5. TC_DASHBOARD_001_Lihat_Dashboard.
6. TC_DASHBOARD_002_Cari_Menu_Dashboard.
7. TC_DASHBOARD_003_Navigasi_Menu_Utama.
8. TC_DASHBOARD_004_Toggle_Theme.
9. TC_MENU_001_Lihat_Daftar_Menu.
10. TC_MENU_002_Cari_Menu_Valid.
11. TC_MENU_003_Cari_Menu_Tidak_Ditemukan.
12. TC_MENU_004_Filter_Kategori_Jenis.
13. TC_MENU_005_Tambah_Menu_Valid.
14. TC_MENU_006_Tambah_Menu_Nama_Kosong.
15. TC_MENU_007_Tambah_Menu_Kategori_Kosong.
16. TC_MENU_008_Tambah_Menu_Data_Nutrisi_Kosong.
17. TC_MENU_009_Edit_Menu_Valid.
18. TC_MENU_010_Edit_Menu_Batal.
19. TC_NUTRITION_001_Analisis_AI_Menu_Valid.
20. TC_NUTRITION_002_Lihat_Analisis_Tersimpan.
21. TC_NUTRITION_003_Generate_Menu_AI_Valid.
22. TC_NUTRITION_004_Generate_Menu_AI_Input_Kosong.
23. TC_PLATE_001_Tambah_Menu_Ke_Piringku.
24. TC_PLATE_002_Tambah_Menu_Maksimal.
25. TC_PLATE_003_Filter_Menu_Piringku.
26. TC_PLATE_004_Analisis_Komposisi_Piringku.
27. TC_PLAN_001_Pilih_Lokasi_Distribusi.
28. TC_PLAN_002_Filter_Periode_Jadwal.
29. TC_PLAN_003_Susun_Jadwal_Mingguan.
30. TC_PLAN_004_Simpan_Jadwal_Konfirmasi.
31. TC_PLAN_005_Simpan_Jadwal_Batal.
32. TC_PLAN_006_Cari_Menu_Jadwal_Tidak_Ditemukan.
33. TC_MENU_011_Hapus_Menu_Batal.
34. TC_MENU_012_Hapus_Menu_Konfirmasi.
35. TC_AUTH_005_Logout_Valid.
36. TC_AUTH_006_Akses_Setelah_Logout.

