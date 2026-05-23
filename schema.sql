-- =====================================================
-- Modul Perencanaan Menu & Analisis Gizi (AI-Driven)
-- Database: MySQL (mengikuti konvensi dari CONTOH)
-- =====================================================

-- Tabel untuk menyimpan data menu makanan
CREATE TABLE IF NOT EXISTS menus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kategori ENUM('Siswa', 'Balita', 'Ibu Hamil') NOT NULL,
  deskripsi TEXT,
  gambar_url VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk menyimpan bahan baku per menu
-- Catatan: Modul Master Bahan Baku belum ada.
-- Kolom 'bahan_baku_ref_id' disiapkan untuk relasi future dengan tabel master bahan baku.
-- Saat ini nama bahan baku disimpan sebagai teks sementara.
CREATE TABLE IF NOT EXISTS menu_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  bahan_baku_ref_id INT DEFAULT NULL,
  nama_bahan VARCHAR(255) NOT NULL,
  jumlah DECIMAL(10,2) NOT NULL,
  satuan VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

-- Tabel untuk menyimpan data gizi per menu
CREATE TABLE IF NOT EXISTS menu_nutrition (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL UNIQUE,
  kalori DECIMAL(10,2) DEFAULT 0,
  protein DECIMAL(10,2) DEFAULT 0,
  lemak DECIMAL(10,2) DEFAULT 0,
  karbohidrat DECIMAL(10,2) DEFAULT 0,
  serat DECIMAL(10,2) DEFAULT 0,
  gula DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

-- Tabel untuk menyimpan makronutrien tambahan manual (opsional) per menu
CREATE TABLE IF NOT EXISTS menu_manual_macronutrients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  nama VARCHAR(120) NOT NULL,
  nilai DECIMAL(10,2) DEFAULT 0,
  satuan VARCHAR(30) NOT NULL DEFAULT 'g',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

-- Tabel untuk menyimpan log rekomendasi AI
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  jenis ENUM('Gizi', 'Bahan', 'Umum') NOT NULL DEFAULT 'Gizi',
  rekomendasi TEXT NOT NULL,
  skor_gizi DECIMAL(5,2) DEFAULT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

-- Tabel lokasi distribusi MBG
CREATE TABLE IF NOT EXISTS distribution_locations (
  id VARCHAR(80) PRIMARY KEY,
  type ENUM('sekolah', 'posyandu') NOT NULL,
  name VARCHAR(255) NOT NULL,
  target VARCHAR(120) NOT NULL,
  schedule_label VARCHAR(120) NOT NULL,
  note TEXT,
  image_key VARCHAR(60) DEFAULT 'students',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS distribution_location_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  target VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES distribution_locations(id) ON DELETE CASCADE
);

-- Tabel jadwal mingguan per lokasi distribusi
CREATE TABLE IF NOT EXISTS weekly_plan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  location_id VARCHAR(80) NOT NULL,
  date_key DATE NOT NULL,
  menu_id INT NOT NULL,
  slot_type ENUM('makanan', 'minuman') NOT NULL DEFAULT 'makanan',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_weekly_item (location_id, date_key, menu_id),
  INDEX idx_weekly_location_date (location_id, date_key),
  FOREIGN KEY (location_id) REFERENCES distribution_locations(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weekly_plan_saved_status (
  location_id VARCHAR(80) PRIMARY KEY,
  saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES distribution_locations(id) ON DELETE CASCADE
);

-- =====================================================
-- Mock Data
-- =====================================================

INSERT IGNORE INTO menus (id, nama, kategori, deskripsi) VALUES
(1, 'Nasi Ayam Seimbang', 'Siswa', 'Menu siswa dengan karbo, protein, dan sayur seimbang'),
(2, 'Sup Sayur Lembut', 'Balita', 'Menu balita dengan tekstur lebih lembut dan mudah cerna'),
(3, 'Nasi Ikan + Susu', 'Ibu Hamil', 'Menu ibu hamil kaya protein dan mikronutrien penting'),
(4, 'Soto Protein Tinggi', 'Siswa', 'Porsi besar untuk kebutuhan energi lebih tinggi'),
(5, 'Bubur Plus Telur', 'Balita', 'Porsi kecil praktis dengan protein cukup');

INSERT IGNORE INTO menu_ingredients (menu_id, nama_bahan, jumlah, satuan) VALUES
-- Nasi Goreng Ayam
(1, 'Beras', 0.15, 'kg'),
(1, 'Daging Ayam', 0.10, 'kg'),
(1, 'Telur Ayam', 1, 'butir'),
(1, 'Bawang Merah', 0.03, 'kg'),
(1, 'Kecap Manis', 0.02, 'liter'),
-- Sup Sayur Bening
(2, 'Wortel', 0.05, 'kg'),
(2, 'Bayam', 0.05, 'kg'),
(2, 'Jagung Manis', 0.05, 'kg'),
(2, 'Bawang Putih', 0.01, 'kg'),
-- Bubur Ayam
(3, 'Beras', 0.10, 'kg'),
(3, 'Daging Ayam', 0.08, 'kg'),
(3, 'Cakwe', 0.03, 'kg'),
(3, 'Kecap Asin', 0.01, 'liter'),
-- Soto Betawi
(4, 'Daging Sapi', 0.12, 'kg'),
(4, 'Santan', 0.10, 'liter'),
(4, 'Kentang', 0.05, 'kg'),
(4, 'Tomat', 0.03, 'kg'),
-- Pisang Goreng
(5, 'Pisang Raja', 2, 'buah'),
(5, 'Tepung Terigu', 0.05, 'kg'),
(5, 'Keju Parut', 0.03, 'kg');

INSERT IGNORE INTO menu_nutrition (menu_id, kalori, protein, lemak, karbohidrat, serat, gula) VALUES
(1, 450.00, 22.50, 15.00, 55.00, 2.50, 3.00),
(2, 85.00, 3.00, 1.50, 15.00, 4.50, 5.00),
(3, 320.00, 18.00, 8.00, 45.00, 1.00, 2.00),
(4, 520.00, 28.00, 25.00, 40.00, 3.00, 4.00),
(5, 280.00, 5.00, 12.00, 40.00, 2.00, 18.00);

INSERT IGNORE INTO distribution_locations
(id, type, name, target, schedule_label, note, image_key) VALUES
('sdn-01-sukamaju', 'sekolah', 'SD Negeri 01 Sukamaju', '320 siswa', 'Sesi pagi', 'Prioritas menu aktif dan porsi siswa dengan variasi lauk cukup.', 'students'),
('smpn-03-sukamaju', 'sekolah', 'SMP Negeri 03 Sukamaju', '410 siswa', 'Sesi siang', 'Cek rotasi protein agar menu tidak terasa berulang.', 'students'),
('posyandu-melati-balita', 'posyandu', 'Posyandu Melati', '132 penerima', 'Sesi timbang & edukasi', 'Balita memakai porsi kecil bertekstur lembut; ibu hamil diprioritaskan protein, folat, dan sayur hijau.', 'pregnant'),
('posyandu-mawar', 'posyandu', 'Posyandu Mawar', '120 penerima', 'Sesi PMT & konseling', 'Balita dijaga tekstur dan energi; ibu hamil difokuskan pada protein, zat besi, dan energi cukup.', 'pregnant');

INSERT IGNORE INTO distribution_location_recipients
(location_id, label, target) VALUES
('sdn-01-sukamaju', 'Siswa', '320 siswa'),
('smpn-03-sukamaju', 'Siswa', '410 siswa'),
('posyandu-melati-balita', 'Balita', '85 balita'),
('posyandu-melati-balita', 'Ibu Hamil', '47 ibu hamil'),
('posyandu-mawar', 'Balita', '58 balita'),
('posyandu-mawar', 'Ibu Hamil', '62 ibu hamil');

-- =====================================================
-- Schema Additions: Kolom finansial & substitusi
-- =====================================================

-- Kolom baru untuk tabel menus
ALTER TABLE menus ADD COLUMN IF NOT EXISTS harga_jual INT DEFAULT 0;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_substituted TINYINT(1) DEFAULT 0;

-- Kolom baru untuk menu_ingredients
ALTER TABLE menu_ingredients ADD COLUMN IF NOT EXISTS harga_satuan INT DEFAULT 0 COMMENT 'Harga per satuan dalam rupiah';

-- Migrasi kategori lama ke kategori distribusi MBG baru
UPDATE menus SET kategori = 'Siswa' WHERE kategori IN ('Sarapan', 'Makan Siang', 'Makan Malam');
-- Data migrasi kategori lama ke kategori utama
UPDATE menus SET kategori = 'Siswa' WHERE kategori IN ('Sarapan', 'Makan Siang', 'Makan Malam', 'Porsi Besar');
UPDATE menus SET kategori = 'Balita' WHERE kategori IN ('Snack', 'Minuman', 'Porsi Kecil');
ALTER TABLE menus MODIFY COLUMN kategori ENUM('Siswa', 'Balita', 'Ibu Hamil') NOT NULL;

-- Update mock data dengan harga jual
UPDATE menus SET harga_jual = 18000 WHERE id = 1;
UPDATE menus SET harga_jual = 8000  WHERE id = 2;
UPDATE menus SET harga_jual = 12000 WHERE id = 3;
UPDATE menus SET harga_jual = 22000 WHERE id = 4;
UPDATE menus SET harga_jual = 10000 WHERE id = 5;

-- Update mock data ingredients dengan harga satuan (per satuan dasar)
UPDATE menu_ingredients SET harga_satuan = 14000 WHERE nama_bahan = 'Beras';
UPDATE menu_ingredients SET harga_satuan = 38000 WHERE nama_bahan = 'Daging Ayam';
UPDATE menu_ingredients SET harga_satuan = 30000 WHERE nama_bahan = 'Telur Ayam';
UPDATE menu_ingredients SET harga_satuan = 25000 WHERE nama_bahan = 'Bawang Merah';
UPDATE menu_ingredients SET harga_satuan = 20000 WHERE nama_bahan = 'Kecap Manis';
UPDATE menu_ingredients SET harga_satuan = 8000  WHERE nama_bahan = 'Wortel';
UPDATE menu_ingredients SET harga_satuan = 12000 WHERE nama_bahan = 'Bayam';
UPDATE menu_ingredients SET harga_satuan = 8000  WHERE nama_bahan = 'Jagung Manis';
UPDATE menu_ingredients SET harga_satuan = 30000 WHERE nama_bahan = 'Bawang Putih';
UPDATE menu_ingredients SET harga_satuan = 15000 WHERE nama_bahan = 'Kecap Asin';
UPDATE menu_ingredients SET harga_satuan = 25000 WHERE nama_bahan = 'Cakwe';
UPDATE menu_ingredients SET harga_satuan = 80000 WHERE nama_bahan = 'Daging Sapi';
UPDATE menu_ingredients SET harga_satuan = 15000 WHERE nama_bahan = 'Santan';
UPDATE menu_ingredients SET harga_satuan = 12000 WHERE nama_bahan = 'Kentang';
UPDATE menu_ingredients SET harga_satuan = 10000 WHERE nama_bahan = 'Tomat';
UPDATE menu_ingredients SET harga_satuan = 12000 WHERE nama_bahan = 'Pisang Raja';
UPDATE menu_ingredients SET harga_satuan = 12000 WHERE nama_bahan = 'Tepung Terigu';
UPDATE menu_ingredients SET harga_satuan = 50000 WHERE nama_bahan = 'Keju Parut';
