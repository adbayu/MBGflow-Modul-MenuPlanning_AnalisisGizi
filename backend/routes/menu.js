const express = require("express");
const router = express.Router();
const db = require("../db");
const aiService = require("../services/aiNutritionService");
const upload = require("../middleware/upload");
const rawMaterialClient = require("../services/rawMaterialApiClient");
const { getRawMaterialId, mapIngredientForInsert } = require("../services/ingredientMapper");

function normalizeDayPlan(raw) {
  if (!raw || typeof raw !== "object") {
    return { makananIds: [], minumanIds: [] };
  }

  const pickIds = (value) =>
    Array.isArray(value)
      ? value.map((id) => Number(id)).filter(Number.isFinite)
      : [];

  return {
    makananIds: pickIds(raw.makananIds),
    minumanIds: pickIds(raw.minumanIds),
  };
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}



const ALLOWED_KATEGORI = ["Siswa", "Balita", "Ibu Hamil", "Ibu Menyusui"];

function convertIngredientCost(jumlah, inputUnit, baseUnit, hargaSatuan) {
  const qty = Number(jumlah) || 0;
  const price = Number(hargaSatuan) || 0;
  const from = String(inputUnit || "").toLowerCase();
  const to = String(baseUnit || inputUnit || "").toLowerCase();
  let normalizedQty = qty;
  if (from === "g" && to === "kg") normalizedQty = qty / 1000;
  if (from === "kg" && to === "g") normalizedQty = qty * 1000;
  if (from === "ml" && to === "liter") normalizedQty = qty / 1000;
  if (from === "liter" && to === "ml") normalizedQty = qty * 1000;
  return Math.round(normalizedQty * price);
}

function calculateMenuHpp(ingredients) {
  return (ingredients || []).reduce((sum, ingredient) => {
    return sum + convertIngredientCost(
      ingredient.jumlah,
      ingredient.satuan,
      ingredient.unit_snapshot || ingredient.satuan,
      ingredient.harga_satuan,
    );
  }, 0);
}

async function prepareIngredientsForSave(menuId, ingredients, options = {}) {
  const warnings = [];
  const prepared = [];
  const kitchenId = options.kitchen_id || options.kitchenId || null;

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return { values: [], warnings };
  }

  for (const ingredient of ingredients) {
    const rawMaterialId = getRawMaterialId(ingredient);
    let rawMaterial = null;
    let availability = null;

    if (rawMaterialId) {
      try {
        rawMaterial = await rawMaterialClient.getRawMaterialById(rawMaterialId);
        if (rawMaterial.status && rawMaterial.status !== "active") {
          const error = new Error(`Bahan baku ${rawMaterialId} tidak aktif`);
          error.statusCode = 400;
          error.code = "RAW_MATERIAL_INACTIVE";
          throw error;
        }

        if (kitchenId) {
          try {
            availability = await rawMaterialClient.checkAvailability(rawMaterialId, {
              kitchen_id: kitchenId,
              quantity: ingredient.jumlah,
              unit: ingredient.satuan || rawMaterial.unit,
            });
          } catch (availabilityError) {
            if (["STOCK_NOT_FOUND", "RAW_MATERIAL_SERVICE_UNAVAILABLE"].includes(availabilityError.code)) {
              warnings.push({
                code: availabilityError.code,
                raw_material_id: rawMaterialId,
                message: availabilityError.message,
              });
            } else {
              throw availabilityError;
            }
          }
        }
      } catch (error) {
        if (error.code === "RAW_MATERIAL_NOT_FOUND" || error.code === "INVALID_RAW_MATERIAL_DTO" || error.code === "RAW_MATERIAL_INACTIVE") {
          error.statusCode = error.statusCode || 400;
          throw error;
        }
        warnings.push({
          code: error.code || "RAW_MATERIAL_SERVICE_UNAVAILABLE",
          raw_material_id: rawMaterialId,
          message: error.message,
        });
      }
    }

    prepared.push(mapIngredientForInsert(menuId, ingredient, rawMaterial, availability));
  }

  return { values: prepared, warnings };
}

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
               n.id AS nutrition_id,
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

    const [manualRows] = await db.query(
      `
        SELECT menu_id, nama, nilai, satuan
        FROM menu_manual_macronutrients
        WHERE menu_id IN (${placeholders})
      `,
      menuIds,
    );

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
    const targetKey = String(req.body?.targetKey || req.body?.target_key || "");
    const menuNames = rows.map((item) => item.nama).join(" + ");
    const missingNutrition = rows
      .filter((item) => !item.nutrition_id)
      .map((item) => item.nama);
    const analysis = await aiService.analyzeNutrition(
      nutrition,
      `Piringku: ${menuNames}`,
      {
        targetKey,
        target,
        kategori: target,
        deskripsi: `Analisis gabungan ${rows.length} menu untuk ${target}. Menu: ${menuNames}`,
        manualNutrients: manualRows,
        requireAi: true,
      },
    );
    if (missingNutrition.length > 0) {
      analysis.data_quality = analysis.data_quality || {
        is_complete: true,
        warnings: [],
      };
      analysis.data_quality.is_complete = false;
      analysis.data_quality.warnings = [
        ...analysis.data_quality.warnings,
        `Data nutrisi belum ada untuk: ${missingNutrition.join(", ")}.`,
      ];
      analysis.status = "Data Belum Lengkap";
    }

    res.json({
      ...analysis,
      combined_menu_ids: menuIds,
      combined_menu_count: rows.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/distribution-locations - Lokasi distribusi dari database
router.get("/distribution-locations", async (_req, res) => {
  try {
    const [locations] = await db.query(`
      SELECT id, type, name, target, schedule_label AS schedule, note, image_key
      FROM distribution_locations
      ORDER BY FIELD(type, 'sekolah', 'posyandu'), name
    `);
    const [recipients] = await db.query(`
      SELECT location_id, label, target
      FROM distribution_location_recipients
      ORDER BY id
    `);

    const recipientMap = recipients.reduce((acc, item) => {
      if (!acc[item.location_id]) acc[item.location_id] = [];
      acc[item.location_id].push({ label: item.label, target: item.target });
      return acc;
    }, {});

    res.json(
      locations.map((location) => ({
        ...location,
        recipients: recipientMap[location.id] || [],
      })),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/menu/distribution-locations - Tambah lokasi distribusi
router.post("/distribution-locations", async (req, res) => {
  const {
    id,
    type,
    name,
    target,
    schedule,
    note,
    image_key = "students",
    recipients = [],
  } = req.body || {};

  if (!id || !type || !name || !target || !schedule) {
    return res.status(400).json({ error: "Data lokasi belum lengkap" });
  }

  if (!["sekolah", "posyandu"].includes(type)) {
    return res.status(400).json({ error: "Tipe lokasi tidak valid" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO distribution_locations
       (id, type, name, target, schedule_label, note, image_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         type = VALUES(type),
         name = VALUES(name),
         target = VALUES(target),
         schedule_label = VALUES(schedule_label),
         note = VALUES(note),
         image_key = VALUES(image_key)`,
      [id, type, name, target, schedule, note || null, image_key],
    );

    await connection.query(
      "DELETE FROM distribution_location_recipients WHERE location_id = ?",
      [id],
    );

    const recipientRows = Array.isArray(recipients)
      ? recipients
          .filter((item) => item?.label && item?.target)
          .map((item) => [id, item.label, item.target])
      : [];

    if (recipientRows.length > 0) {
      await connection.query(
        "INSERT INTO distribution_location_recipients (location_id, label, target) VALUES ?",
        [recipientRows],
      );
    }

    await connection.commit();
    res.status(201).json({ message: "Lokasi distribusi tersimpan" });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// GET /api/menu/weekly-plans - Jadwal mingguan semua lokasi
router.get("/weekly-plans", async (_req, res) => {
  try {
    const [items] = await db.query(`
      SELECT location_id, DATE_FORMAT(date_key, '%Y-%m-%d') AS date_key,
             menu_id, slot_type, position
      FROM weekly_plan_items
      ORDER BY location_id, date_key, slot_type, position
    `);
    const [savedRows] = await db.query(`
      SELECT location_id, saved_at
      FROM weekly_plan_saved_status
    `);

    const plans = {};
    items.forEach((item) => {
      if (!plans[item.location_id]) plans[item.location_id] = {};
      if (!plans[item.location_id][item.date_key]) {
        plans[item.location_id][item.date_key] = {
          makananIds: [],
          minumanIds: [],
        };
      }

      const key = item.slot_type === "minuman" ? "minumanIds" : "makananIds";
      plans[item.location_id][item.date_key][key].push(Number(item.menu_id));
    });

    const savedScheduleMap = {};
    savedRows.forEach((item) => {
      savedScheduleMap[item.location_id] = new Date(
        item.saved_at,
      ).toISOString();
    });

    res.json({ plans, savedScheduleMap });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/menu/weekly-plans - Simpan jadwal mingguan semua lokasi
router.put("/weekly-plans", async (req, res) => {
  const plans = req.body?.plans;
  const savedScheduleMap = req.body?.savedScheduleMap || {};

  if (!plans || typeof plans !== "object") {
    return res.status(400).json({ error: "plans harus berupa object" });
  }

  const menuIds = new Set();
  Object.values(plans).forEach((locationPlan) => {
    if (!locationPlan || typeof locationPlan !== "object") return;
    Object.values(locationPlan).forEach((day) => {
      const normalized = normalizeDayPlan(day);
      [...normalized.makananIds, ...normalized.minumanIds].forEach((id) =>
        menuIds.add(id),
      );
    });
  });

  const existingMenuIds = new Set();
  if (menuIds.size > 0) {
    const ids = Array.from(menuIds);
    const [rows] = await db.query(
      `SELECT id FROM menus WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids,
    );
    rows.forEach((row) => existingMenuIds.add(Number(row.id)));
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM weekly_plan_items");
    await connection.query("DELETE FROM weekly_plan_saved_status");

    const itemRows = [];
    Object.entries(plans).forEach(([locationId, locationPlan]) => {
      if (!locationPlan || typeof locationPlan !== "object") return;
      Object.entries(locationPlan).forEach(([dateKey, day]) => {
        if (!isDateKey(dateKey)) return;
        const normalized = normalizeDayPlan(day);
        normalized.makananIds.forEach((menuId, idx) => {
          if (existingMenuIds.has(menuId)) {
            itemRows.push([locationId, dateKey, menuId, "makanan", idx]);
          }
        });
        normalized.minumanIds.forEach((menuId, idx) => {
          if (existingMenuIds.has(menuId)) {
            itemRows.push([locationId, dateKey, menuId, "minuman", idx]);
          }
        });
      });
    });

    if (itemRows.length > 0) {
      await connection.query(
        `INSERT INTO weekly_plan_items
         (location_id, date_key, menu_id, slot_type, position)
         VALUES ?`,
        [itemRows],
      );
    }

    const savedRows = Object.entries(savedScheduleMap)
      .filter(([, value]) => value)
      .map(([locationId, value]) => [
        locationId,
        Number.isNaN(Date.parse(value)) ? new Date() : new Date(value),
      ]);

    if (savedRows.length > 0) {
      await connection.query(
        "INSERT INTO weekly_plan_saved_status (location_id, saved_at) VALUES ?",
        [savedRows],
      );
    }

    await connection.commit();
    res.json({
      message: "Jadwal mingguan tersimpan",
      item_count: itemRows.length,
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});


// GET /api/menu/raw-materials - Proxy bahan baku untuk Recipe Builder
router.get("/raw-materials", async (req, res) => {
  try {
    const baseUrl = (process.env.RAW_MATERIAL_SERVICE_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
    const token = process.env.RAW_MATERIAL_SERVICE_TOKEN || "";
    const query = new URLSearchParams(req.query).toString();
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}/api/v1/raw-materials${query ? `?${query}` : ""}`, { headers });
    const body = await response.json();
    if (!response.ok) return res.status(response.status).json(body);
    res.json(body);
  } catch (error) {
    res.status(503).json({ error: "RAW_MATERIAL_SERVICE_UNAVAILABLE", message: error.message });
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
    cara_memasak,
    harga_jual,
    ingredients,
    nutrition,
    manual_macronutrients,
  } = req.body;

  if (!nama || !kategori) {
    return res.status(400).json({ error: "Nama dan kategori wajib diisi" });
  }
  // Validasi kategori hanya boleh Siswa, Balita, atau Ibu Hamil
  const allowedKategori = ALLOWED_KATEGORI;
  if (!allowedKategori.includes(kategori)) {
    return res
      .status(400)
      .json({ error: "Kategori hanya boleh Siswa, Balita, Ibu Hamil, atau Ibu Menyusui" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert Menu
    const [menuResult] = await connection.query(
      "INSERT INTO menus (nama, kategori, deskripsi, cara_memasak, harga_jual) VALUES (?, ?, ?, ?, ?)",
      [nama, kategori, deskripsi || null, cara_memasak || null, Number(harga_jual) || 0],
    );
    const menuId = menuResult.insertId;

    // 2. Insert Ingredients
    const integrationWarnings = [];
    if (ingredients && ingredients.length > 0) {
      const preparedIngredients = await prepareIngredientsForSave(menuId, ingredients, req.body);
      integrationWarnings.push(...preparedIngredients.warnings);
      await connection.query(
        `INSERT INTO menu_ingredients
          (menu_id, bahan_baku_ref_id, raw_material_id, nama_bahan, jumlah, satuan, harga_satuan,
           unit_snapshot, quality_status_snapshot, availability_status_snapshot,
           price_updated_at_snapshot, stock_checked_at)
         VALUES ?`,
        [preparedIngredients.values],
      );
      const nextHpp = calculateMenuHpp(preparedIngredients.values.map((value) => ({
        jumlah: value[4],
        satuan: value[5],
        harga_satuan: value[6],
        unit_snapshot: value[7],
      })));
      await connection.query("UPDATE menus SET harga_jual = ? WHERE id = ?", [nextHpp, menuId]);
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
      integration_warnings: integrationWarnings,
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
    cara_memasak,
    harga_jual,
    ingredients,
    nutrition,
    manual_macronutrients,
  } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update menu base info
    // Validasi kategori hanya boleh Siswa, Balita, atau Ibu Hamil
    const allowedKategori = ALLOWED_KATEGORI;
    if (!allowedKategori.includes(kategori)) {
      return res
        .status(400)
        .json({ error: "Kategori hanya boleh Siswa, Balita, Ibu Hamil, atau Ibu Menyusui" });
    }
    await connection.query(
      "UPDATE menus SET nama = ?, kategori = ?, deskripsi = ?, cara_memasak = ?, harga_jual = ? WHERE id = ?",
      [nama, kategori, deskripsi || null, cara_memasak || null, Number(harga_jual) || 0, menuId],
    );

    // 2. Replace ingredients (delete and re-insert)
    const integrationWarnings = [];
    if (ingredients) {
      await connection.query("DELETE FROM menu_ingredients WHERE menu_id = ?", [
        menuId,
      ]);
      if (ingredients.length > 0) {
        const preparedIngredients = await prepareIngredientsForSave(menuId, ingredients, req.body);
        integrationWarnings.push(...preparedIngredients.warnings);
        await connection.query(
          `INSERT INTO menu_ingredients
            (menu_id, bahan_baku_ref_id, raw_material_id, nama_bahan, jumlah, satuan, harga_satuan,
             unit_snapshot, quality_status_snapshot, availability_status_snapshot,
             price_updated_at_snapshot, stock_checked_at)
           VALUES ?`,
          [preparedIngredients.values],
        );
        const nextHpp = calculateMenuHpp(preparedIngredients.values.map((value) => ({
          jumlah: value[4],
          satuan: value[5],
          harga_satuan: value[6],
          unit_snapshot: value[7],
        })));
        await connection.query("UPDATE menus SET harga_jual = ? WHERE id = ?", [nextHpp, menuId]);
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
      integration_warnings: integrationWarnings,
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
    const [manualRows] = await db.query(
      "SELECT menu_id, nama, nilai, satuan FROM menu_manual_macronutrients WHERE menu_id = ? ORDER BY id",
      [req.params.id],
    );

    // Run AI analysis (async — powered by Google Gemini AI)
    const analysis = await aiService.analyzeNutrition(nutrition, menu.nama, {
      targetKey: req.body?.targetKey || req.body?.target_key,
      kategori: menu.kategori,
      deskripsi: menu.deskripsi,
      menuType: req.body?.menuType || req.body?.menu_type,
      manualNutrients: manualRows,
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
      "SELECT id, menu_id, bahan_baku_ref_id, raw_material_id, nama_bahan, jumlah, satuan, harga_satuan, unit_snapshot, quality_status_snapshot, availability_status_snapshot, stock_checked_at FROM menu_ingredients WHERE menu_id = ?",
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
    let sourceIngredients = ingredients;
    if (!Array.isArray(sourceIngredients) || sourceIngredients.length === 0) {
      const baseUrl = (process.env.RAW_MATERIAL_SERVICE_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
      const token = process.env.RAW_MATERIAL_SERVICE_TOKEN || "";
      const headers = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${baseUrl}/api/v1/raw-materials?status=active&include=availability&kitchen_id=${encodeURIComponent(req.body.kitchen_id || "k-1")}`, { headers });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.error || "Gagal mengambil bahan baku");
      sourceIngredients = (body.data || []).map((material) => ({
        raw_material_id: material.id,
        nama: material.name,
        nama_bahan: material.name,
        jumlah: 100,
        satuan: material.unit,
        harga_satuan: material.standard_price || 0,
        category: material.category,
        qty_available: material.availability?.qty_available ?? null,
      }));
    }
    if (!sourceIngredients || !Array.isArray(sourceIngredients) || sourceIngredients.length === 0) {
      return res.status(400).json({ error: "Bahan baku tersedia tidak ditemukan" });
    }
    const result = await aiService.generateMenuFromIngredients(
      sourceIngredients,
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
      const subtotal = convertIngredientCost(
        jumlah,
        ing.satuan,
        ing.unit_snapshot || ing.satuan,
        hargaSatuan,
      );
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
