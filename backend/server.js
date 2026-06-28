const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const menuRoutes = require("./routes/menu");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3002;

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...defaultCorsOrigins, ...configuredOrigins];
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.includes("*")) {
      const pattern = new RegExp(
        `^${allowedOrigin
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")}$`,
      );
      return pattern.test(origin);
    }
    return origin === allowedOrigin;
  });
}

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = getAllowedOrigins();
      if (isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
  }),
);
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/menu", menuRoutes);
app.use("/api/auth", authRoutes);

// Basic healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "OK", module: "Menu Planning & Analisis Gizi" });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint API tidak ditemukan" });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Terjadi kesalahan server" });
});

// Setup DB connection listener
const db = require("./db");
db.getConnection()
  .then((conn) => {
    console.log("Database connected successfully");
    conn.release();
  })
  .catch((err) => {
    console.error("Failed to connect to the database:", err.message);
  });

app.listen(PORT, () => {
  console.log(`Menu Planning backend is running on http://localhost:${PORT}`);
});
