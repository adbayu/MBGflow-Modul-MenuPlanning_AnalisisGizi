const express = require("express");
const db = require("../db");
const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, username, nama, role
       FROM users
       WHERE username = ?
         AND password = ?
         AND is_active = 1
       LIMIT 1`,
      [username, password],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Username atau password salah" });
    }

    const user = rows[0];
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || "Ahli Gizi",
        nama: user.nama || user.username,
      },
      token: Buffer.from(`${user.username}:${Date.now()}`).toString("base64"),
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error.code === "ER_NO_SUCH_TABLE"
          ? "Tabel users belum tersedia di database"
          : "Login gagal",
    });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logout berhasil" });
});

module.exports = router;
