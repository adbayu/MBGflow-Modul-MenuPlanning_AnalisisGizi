const express = require("express");
const router = express.Router();
const db = require("../db");
const aiService = require("../services/aiNutritionService");
const upload = require("../middleware/upload");

// ============================================================
// CRUD MENU
// ============================================================

// GET /api/menu - Get all menus with nutrition summary
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT m.*,
            n.kalori, n.protein, n.lemak, n.karbohidrat, n.serat, n.gula
            FROM menus m
            LEFT JOIN menu_nutrition n ON m.id = n.menu_id
            ORDER BY m.created_at DESC
        `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/dummy-stock - Dummy stok bahan untuk simulasi AI recommendation
router.get("/dummy-stock", async (_req, res) => {
  res.json({
    source: "dummy",
    updated_at: new Date().toISOString(),
    items: [
      { nama: "Beras", qty: 5000, satuan: "g" },
      { nama: "Ayam", qty: 2000, satuan: "g" },
      { nama: "Tempe", qty: 1500, satuan: "g" },
      { nama: "Tahu", qty: 1200, satuan: "g" },
      { nama: "Bayam", qty: 800, satuan: "g" },
      { nama: "Wortel", qty: 1000, satuan: "g" },
      { nama: "Telur", qty: 30, satuan: "butir" },
      { nama: "Susu UHT", qty: 3000, satuan: "ml" },
      { nama: "Pisang", qty: 25, satuan: "buah" },
    ],
  });
});

// POST /api/menu/analyze-plate - Analyze combined Piringku selection with AI
router.post("/analyze-plate", async (req, res) => {
  try {
    const menuIds = Array.isArray(req.body?.menuIds)
      ? req.body.menuIds.map((id) => Number(id)).filter(Number.isFinite)
      : [];

    if (menuIds.length === 0) {
      return res.status(400).json({ error: "Pilih minimal satu menu" });
    }

    const placeholders = menuIds.map(() => "?").join(",");
    const [rows] = await db.query(
      `
        SELECT m.id, m.nama, m.kategori, m.deskripsi,
               n.kalori, n.protein, n.lemak, n.karbohidrat, n.serat, n.gula
        FROM menus m
        LEFT JOIN menu_nutrition n ON m.id = n.menu_id
        WHERE m.id IN (${placeholders})
      `,
      menuIds,
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }

    const nutrition = rows.reduce(
      (acc, item) => {
        acc.kalori += Number(item.kalori || 0);
        acc.protein += Number(item.protein || 0);
        acc.lemak += Number(item.lemak || 0);
        acc.karbohidrat += Number(item.karbohidrat || 0);
        acc.serat += Number(item.serat || 0);
        acc.gula += Number(item.gula || 0);
        return acc;
      },
      { kalori: 0, protein: 0, lemak: 0, karbohidrat: 0, serat: 0, gula: 0 },
    );

    const target = String(req.body?.target || "Target MBG");
    const menuNames = rows.map((item) => item.nama).join(" + ");
    const analysis = await aiService.analyzeNutrition(
      nutrition,
      `Piringku: ${menuNames}`,
      {
        kategori: target,
        deskripsi: `Analisis gabungan ${rows.length} menu untuk ${target}. Menu: ${menuNames}`,
      },
    );

    res.json({
      ...analysis,
      combined_menu_ids: menuIds,
      combined_menu_count: rows.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/:id - Get single menu with ingredients and nutrition
router.get("/:id", async (req, res) => {
  try {
    const [menuRows] = await db.query("SELECT * FROM menus WHERE id = ?", [
      req.params.id,
    ]);
    if (menuRows.length === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }

    const [ingredients] = await db.query(
      "SELECT * FROM menu_ingredients WHERE menu_id = ? ORDER BY id",
      [req.params.id],
    );

    const [nutrition] = await db.query(
      "SELECT * FROM menu_nutrition WHERE menu_id = ?",
      [req.params.id],
    );

    const [manualMacros] = await db.query(
      "SELECT * FROM menu_manual_macronutrients WHERE menu_id = ? ORDER BY id",
      [req.params.id],
    );

    res.json({
      ...menuRows[0],
      ingredients,
      nutrition: nutrition[0] || null,
      manual_macronutrients: manualMacros,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/menu - Create new menu with ingredients and nutrition
router.post("/", async (req, res) => {
  const {
    nama,
    kategori,
    deskripsi,
    ingredients,
    nutrition,
    manual_macronutrients,
  } = req.body;

  if (!nama || !kategori) {
    return res.status(400).json({ error: "Nama dan kategori wajib diisi" });
  }
  // Validasi kategori hanya boleh Siswa, Balita, atau Ibu Hamil
  const allowedKategori = ["Siswa", "Balita", "Ibu Hamil"];
  if (!allowedKategori.includes(kategori)) {
    return res
      .status(400)
      .json({ error: "Kategori hanya boleh Siswa, Balita, atau Ibu Hamil" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert Menu
    const [menuResult] = await connection.query(
      "INSERT INTO menus (nama, kategori, deskripsi) VALUES (?, ?, ?)",
      [nama, kategori, deskripsi || null],
    );
    const menuId = menuResult.insertId;

    // 2. Insert Ingredients
    if (ingredients && ingredients.length > 0) {
      const ingredientValues = ingredients.map((ing) => [
        menuId,
        ing.bahan_baku_ref_id || null,
        ing.nama_bahan,
        ing.jumlah,
        ing.satuan,
        ing.harga_satuan || 0,
      ]);
      await connection.query(
        "INSERT INTO menu_ingredients (menu_id, bahan_baku_ref_id, nama_bahan, jumlah, satuan, harga_satuan) VALUES ?",
        [ingredientValues],
      );
    }

    // 3. Insert Nutrition
    if (nutrition) {
      await connection.query(
        `INSERT INTO menu_nutrition (menu_id, kalori, protein, lemak, karbohidrat, serat, gula)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          menuId,
          nutrition.kalori || 0,
          nutrition.protein || 0,
          nutrition.lemak || 0,
          nutrition.karbohidrat || 0,
          nutrition.serat || 0,
          nutrition.gula || 0,
        ],
      );
    }

    // 4. Insert optional manual macronutrients
    if (
      Array.isArray(manual_macronutrients) &&
      manual_macronutrients.length > 0
    ) {
      const macroValues = manual_macronutrients
        .filter((m) => typeof m.nama === "string" && m.nama.trim() !== "")
        .map((m) => [
          menuId,
          m.nama.trim(),
          Number(m.nilai) || 0,
          (m.satuan || "g").trim() || "g",
        ]);

      if (macroValues.length > 0) {
        await connection.query(
          "INSERT INTO menu_manual_macronutrients (menu_id, nama, nilai, satuan) VALUES ?",
          [macroValues],
        );
      }
    }

    await connection.commit();

    // Fetch the complete menu data
    const [newMenu] = await db.query("SELECT * FROM menus WHERE id = ?", [
      menuId,
    ]);
    const [newIngredients] = await db.query(
      "SELECT * FROM menu_ingredients WHERE menu_id = ?",
      [menuId],
    );
    const [newNutrition] = await db.query(
      "SELECT * FROM menu_nutrition WHERE menu_id = ?",
      [menuId],
    );
    const [newManualMacros] = await db.query(
      "SELECT * FROM menu_manual_macronutrients WHERE menu_id = ? ORDER BY id",
      [menuId],
    );

    res.status(201).json({
      message: "Menu berhasil dibuat",
      data: {
        ...newMenu[0],
        ingredients: newIngredients,
        nutrition: newNutrition[0] || null,
        manual_macronutrients: newManualMacros,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// PUT /api/menu/:id - Update menu
router.put("/:id", async (req, res) => {
  const menuId = req.params.id;
  const {
    nama,
    kategori,
    deskripsi,
    ingredients,
    nutrition,
    manual_macronutrients,
  } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update menu base info
    // Validasi kategori hanya boleh Siswa, Balita, atau Ibu Hamil
    const allowedKategori = ["Siswa", "Balita", "Ibu Hamil"];
    if (!allowedKategori.includes(kategori)) {
      return res
        .status(400)
        .json({ error: "Kategori hanya boleh Siswa, Balita, atau Ibu Hamil" });
    }
    await connection.query(
      "UPDATE menus SET nama = ?, kategori = ?, deskripsi = ? WHERE id = ?",
      [nama, kategori, deskripsi || null, menuId],
    );

    // 2. Replace ingredients (delete and re-insert)
    if (ingredients) {
      await connection.query("DELETE FROM menu_ingredients WHERE menu_id = ?", [
        menuId,
      ]);
      if (ingredients.length > 0) {
        const ingredientValues = ingredients.map((ing) => [
          menuId,
          ing.bahan_baku_ref_id || null,
          ing.nama_bahan,
          ing.jumlah,
          ing.satuan,
          ing.harga_satuan || 0,
        ]);
        await connection.query(
          "INSERT INTO menu_ingredients (menu_id, bahan_baku_ref_id, nama_bahan, jumlah, satuan, harga_satuan) VALUES ?",
          [ingredientValues],
        );
      }
    }

    // 3. Upsert nutrition
    if (nutrition) {
      await connection.query(
        `INSERT INTO menu_nutrition (menu_id, kalori, protein, lemak, karbohidrat, serat, gula)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    kalori = VALUES(kalori),
                    protein = VALUES(protein),
                    lemak = VALUES(lemak),
                    karbohidrat = VALUES(karbohidrat),
                    serat = VALUES(serat),
                    gula = VALUES(gula)`,
        [
          menuId,
          nutrition.kalori || 0,
          nutrition.protein || 0,
          nutrition.lemak || 0,
          nutrition.karbohidrat || 0,
          nutrition.serat || 0,
          nutrition.gula || 0,
        ],
      );
    }

    // 4. Replace optional manual macronutrients
    if (manual_macronutrients) {
      await connection.query(
        "DELETE FROM menu_manual_macronutrients WHERE menu_id = ?",
        [menuId],
      );

      if (
        Array.isArray(manual_macronutrients) &&
        manual_macronutrients.length
      ) {
        const macroValues = manual_macronutrients
          .filter((m) => typeof m.nama === "string" && m.nama.trim() !== "")
          .map((m) => [
            menuId,
            m.nama.trim(),
            Number(m.nilai) || 0,
            (m.satuan || "g").trim() || "g",
          ]);

        if (macroValues.length > 0) {
          await connection.query(
            "INSERT INTO menu_manual_macronutrients (menu_id, nama, nilai, satuan) VALUES ?",
            [macroValues],
          );
        }
      }
    }

    await connection.commit();

    // Fetch updated data
    const [updatedMenu] = await db.query("SELECT * FROM menus WHERE id = ?", [
      menuId,
    ]);
    const [updatedIngredients] = await db.query(
      "SELECT * FROM menu_ingredients WHERE menu_id = ?",
      [menuId],
    );
    const [updatedNutrition] = await db.query(
      "SELECT * FROM menu_nutrition WHERE menu_id = ?",
      [menuId],
    );
    const [updatedManualMacros] = await db.query(
      "SELECT * FROM menu_manual_macronutrients WHERE menu_id = ? ORDER BY id",
      [menuId],
    );

    res.json({
      message: "Menu berhasil diperbarui",
      data: {
        ...updatedMenu[0],
        ingredients: updatedIngredients,
        nutrition: updatedNutrition[0] || null,
        manual_macronutrients: updatedManualMacros,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE /api/menu/:id - Delete menu
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM menus WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }
    res.json({ message: "Menu berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AI ANALYSIS & RECOMMENDATIONS
// ============================================================

// POST /api/menu/:id/analyze - Analyze nutrition with AI
router.post("/:id/analyze", async (req, res) => {
  try {
    const [menuRows] = await db.query("SELECT * FROM menus WHERE id = ?", [
      req.params.id,
    ]);
    if (menuRows.length === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }

    const [nutritionRows] = await db.query(
      "SELECT * FROM menu_nutrition WHERE menu_id = ?",
      [req.params.id],
    );
    if (nutritionRows.length === 0) {
      return res
        .status(400)
        .json({ error: "Data gizi belum diisi untuk menu ini" });
    }

    const menu = menuRows[0];
    const nutrition = nutritionRows[0];

    // Run AI analysis (async — powered by Google Gemini AI)
    const analysis = await aiService.analyzeNutrition(nutrition, menu.nama, {
      kategori: menu.kategori,
      deskripsi: menu.deskripsi,
    });

    // Save recommendations to database
    for (const rec of analysis.rekomendasi) {
      await db.query(
        `INSERT INTO ai_recommendations (menu_id, jenis, rekomendasi, skor_gizi) VALUES (?, ?, ?, ?)`,
        [req.params.id, rec.jenis, rec.pesan, analysis.skor_gizi],
      );
    }

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/:id/recommendations - Get AI recommendation history
router.get("/:id/recommendations", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM ai_recommendations WHERE menu_id = ? ORDER BY timestamp DESC LIMIT 20",
      [req.params.id],
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// INTEGRATION ENDPOINTS (untuk Modul Produksi)
// ============================================================

// GET /api/menu/integration/list - Compact menu list for production module
router.get("/integration/list", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT m.id, m.nama, m.kategori, m.is_active,
                   n.kalori, n.protein, n.lemak, n.karbohidrat
            FROM menus m
            LEFT JOIN menu_nutrition n ON m.id = n.menu_id
            WHERE m.is_active = 1
            ORDER BY m.nama
        `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/:id/ingredients - Get ingredients for production calculation
router.get("/:id/ingredients", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, menu_id, bahan_baku_ref_id, nama_bahan, jumlah, satuan FROM menu_ingredients WHERE menu_id = ?",
      [req.params.id],
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/stats/summary - Dashboard stats
router.get("/stats/summary", async (req, res) => {
  try {
    const [totalMenus] = await db.query("SELECT COUNT(*) as total FROM menus");
    const [activeMenus] = await db.query(
      "SELECT COUNT(*) as total FROM menus WHERE is_active = 1",
    );
    const [avgNutrition] = await db.query(`
            SELECT
                ROUND(AVG(kalori), 1) as avg_kalori,
                ROUND(AVG(protein), 1) as avg_protein,
                ROUND(AVG(lemak), 1) as avg_lemak,
                ROUND(AVG(karbohidrat), 1) as avg_karbohidrat
            FROM menu_nutrition
        `);
    const [kategoris] = await db.query(`
            SELECT kategori, COUNT(*) as count
            FROM menus
            GROUP BY kategori
            ORDER BY count DESC
        `);

    res.json({
      total_menus: totalMenus[0].total,
      active_menus: activeMenus[0].total,
      avg_nutrition: avgNutrition[0],
      per_kategori: kategoris,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/menu/ai-generate - Generate menu dari bahan tersedia
// (ditempatkan sebelum /:id agar tidak bentrok dengan route parameter)
router.post("/ai-generate", async (req, res) => {
  try {
    const {
      ingredients,
      kelompok = "porsi_kecil",
      kategori = "Siswa",
    } = req.body;
    if (
      !ingredients ||
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "ingredients harus berupa array bahan baku" });
    }
    const result = await aiService.generateMenuFromIngredients(
      ingredients,
      kelompok,
      kategori,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/:id/hpp - Hitung HPP menu berdasarkan ingredients dan harga satuan
router.get("/:id/hpp", async (req, res) => {
  try {
    const [menuRows] = await db.query("SELECT * FROM menus WHERE id = ?", [
      req.params.id,
    ]);
    if (menuRows.length === 0)
      return res.status(404).json({ error: "Menu tidak ditemukan" });

    const [ingredients] = await db.query(
      "SELECT * FROM menu_ingredients WHERE menu_id = ?",
      [req.params.id],
    );

    let hpp = 0;
    const breakdown = ingredients.map((ing) => {
      const jumlah = Number(ing.jumlah) || 0;
      const hargaSatuan = Number(ing.harga_satuan) || 0;
      const satuan = ing.satuan || "g";
      let multiplier = 1;
      if (satuan === "kg" || satuan === "liter") multiplier = jumlah;
      else if (satuan === "g" || satuan === "ml") multiplier = jumlah / 1000;
      else multiplier = jumlah;
      const subtotal = Math.round(hargaSatuan * multiplier);
      hpp += subtotal;
      return { ...ing, subtotal };
    });

    const menu = menuRows[0];
    const hargaJual = Number(menu.harga_jual) || 0;
    const profitPct =
      hargaJual > 0 ? Math.round(((hargaJual - hpp) / hargaJual) * 100) : 0;

    res.json({
      menu_id: req.params.id,
      hpp,
      harga_jual: hargaJual,
      profit_pct: profitPct,
      breakdown,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// IMAGE UPLOAD & MANAGEMENT
// ============================================================

// POST /api/menu/:id/upload-image - Upload gambar untuk menu
router.post("/:id/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Tidak ada file yang diupload" });
    }

    // Verifikasi menu exists
    const [menuRows] = await db.query("SELECT id FROM menus WHERE id = ?", [
      req.params.id,
    ]);
    if (menuRows.length === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }

    // Simpan URL gambar ke database
    const gambarUrl = `/uploads/menu-images/${req.file.filename}`;
    await db.query("UPDATE menus SET gambar_url = ? WHERE id = ?", [
      gambarUrl,
      req.params.id,
    ]);

    res.json({
      message: "Gambar berhasil diupload",
      gambar_url: gambarUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (error) {
    // Hapus file jika terjadi error
    if (req.file) {
      const fs = require("fs");
      const path = require("path");
      fs.unlink(
        path.join(__dirname, "../uploads/menu-images", req.file.filename),
        (err) => {
          if (err) console.error("Gagal menghapus file:", err);
        },
      );
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/menu/:id/image - Hapus gambar menu
router.delete("/:id/image", async (req, res) => {
  try {
    const [menuRows] = await db.query(
      "SELECT gambar_url FROM menus WHERE id = ?",
      [req.params.id],
    );
    if (menuRows.length === 0) {
      return res.status(404).json({ error: "Menu tidak ditemukan" });
    }

    const gambarUrl = menuRows[0].gambar_url;
    if (!gambarUrl) {
      return res.status(400).json({ error: "Menu tidak memiliki gambar" });
    }

    // Hapus file dari storage
    const fs = require("fs");
    const path = require("path");
    const filename = gambarUrl.split("/").pop();
    const filepath = path.join(__dirname, "../uploads/menu-images", filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Update database
    await db.query("UPDATE menus SET gambar_url = NULL WHERE id = ?", [
      req.params.id,
    ]);

    res.json({ message: "Gambar berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
