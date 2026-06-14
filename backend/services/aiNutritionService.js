function extractJsonFromText(text) {
  let cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .replace(/^[^{]*?\{/s, "{")
    .replace(/\}[^}]*?$/, "}")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  throw new Error("Respons AI tidak bisa di-parse sebagai JSON");
}

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { retryWithBackoff } = require("../utils/retryHelper");

const STATUS = {
  kurang: "Kurang",
  cukup: "Cukup",
  optimal: "Optimal",
  mulaiBerlebih: "Mulai Berlebih",
  terlaluBerlebih: "Terlalu Berlebih",
  tercatat: "Tercatat",
};

const TARGET_AKG_2019 = {
  siswa: {
    label: "Siswa",
    focus:
      "energi untuk aktivitas belajar, protein untuk pertumbuhan, zat besi, vitamin A/C, dan keseimbangan makro",
    nutrients: {
      kalori: { label: "Kalori", target: 600, unit: "kkal", category: "macro" },
      protein: { label: "Protein", target: 25, unit: "g", category: "macro" },
      karbohidrat: {
        label: "Karbohidrat",
        target: 80,
        unit: "g",
        category: "macro",
      },
      lemak: { label: "Lemak", target: 18, unit: "g", category: "macro" },
      serat: { label: "Serat", target: 8, unit: "g", category: "micro" },
      gula: { label: "Gula", target: 12, unit: "g", category: "micro", limitOnly: true },
      "vitamin a": { label: "Vitamin A", target: 180, unit: "mcg", category: "micro" },
      "vitamin c": { label: "Vitamin C", target: 18, unit: "mg", category: "micro" },
      "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg", category: "micro" },
      kalsium: { label: "Kalsium", target: 300, unit: "mg", category: "micro" },
      "zat besi": { label: "Zat Besi", target: 3, unit: "mg", category: "micro" },
      zinc: { label: "Zinc", target: 2.5, unit: "mg", category: "micro" },
      folat: { label: "Folat", target: 120, unit: "mcg", category: "micro" },
      natrium: { label: "Natrium", target: 450, unit: "mg", category: "micro", limitOnly: true },
      kalium: { label: "Kalium", target: 900, unit: "mg", category: "micro" },
      "omega 3": { label: "Omega-3", target: 0.3, unit: "g", category: "micro" },
    },
  },
  balita: {
    label: "Balita",
    focus:
      "kepadatan energi, protein mudah cerna, lemak cukup, zat besi, zinc, vitamin A, dan tekstur menu",
    nutrients: {
      kalori: { label: "Kalori", target: 450, unit: "kkal", category: "macro" },
      protein: { label: "Protein", target: 20, unit: "g", category: "macro" },
      karbohidrat: {
        label: "Karbohidrat",
        target: 65,
        unit: "g",
        category: "macro",
      },
      lemak: { label: "Lemak", target: 15, unit: "g", category: "macro" },
      serat: { label: "Serat", target: 5, unit: "g", category: "micro" },
      gula: { label: "Gula", target: 8, unit: "g", category: "micro", limitOnly: true },
      "vitamin a": { label: "Vitamin A", target: 120, unit: "mcg", category: "micro" },
      "vitamin c": { label: "Vitamin C", target: 12, unit: "mg", category: "micro" },
      "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg", category: "micro" },
      kalsium: { label: "Kalsium", target: 195, unit: "mg", category: "micro" },
      "zat besi": { label: "Zat Besi", target: 2.1, unit: "mg", category: "micro" },
      zinc: { label: "Zinc", target: 1.5, unit: "mg", category: "micro" },
      folat: { label: "Folat", target: 48, unit: "mcg", category: "micro" },
      natrium: { label: "Natrium", target: 240, unit: "mg", category: "micro", limitOnly: true },
      kalium: { label: "Kalium", target: 780, unit: "mg", category: "micro" },
      "omega 3": { label: "Omega-3", target: 0.21, unit: "g", category: "micro" },
    },
  },
  ibu_hamil: {
    label: "Ibu Hamil",
    focus:
      "tambahan energi, protein, zat besi, folat, kalsium, vitamin D, dan kualitas karbohidrat",
    nutrients: {
      kalori: { label: "Kalori", target: 750, unit: "kkal", category: "macro" },
      protein: { label: "Protein", target: 30, unit: "g", category: "macro" },
      karbohidrat: {
        label: "Karbohidrat",
        target: 90,
        unit: "g",
        category: "macro",
      },
      lemak: { label: "Lemak", target: 22, unit: "g", category: "macro" },
      serat: { label: "Serat", target: 10, unit: "g", category: "micro" },
      gula: { label: "Gula", target: 15, unit: "g", category: "micro", limitOnly: true },
      "vitamin a": { label: "Vitamin A", target: 255, unit: "mcg", category: "micro" },
      "vitamin c": { label: "Vitamin C", target: 25.5, unit: "mg", category: "micro" },
      "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg", category: "micro" },
      kalsium: { label: "Kalsium", target: 360, unit: "mg", category: "micro" },
      "zat besi": { label: "Zat Besi", target: 8.1, unit: "mg", category: "micro" },
      zinc: { label: "Zinc", target: 3.6, unit: "mg", category: "micro" },
      folat: { label: "Folat", target: 180, unit: "mcg", category: "micro" },
      natrium: { label: "Natrium", target: 450, unit: "mg", category: "micro", limitOnly: true },
      kalium: { label: "Kalium", target: 1410, unit: "mg", category: "micro" },
      "omega 3": { label: "Omega-3", target: 0.42, unit: "g", category: "micro" },
    },
  },
  ibu_menyusui: {
    label: "Ibu Menyusui",
    focus:
      "energi laktasi, protein, cairan, kalsium, vitamin A/C, zinc, dan lemak sehat",
    nutrients: {
      kalori: { label: "Kalori", target: 800, unit: "kkal", category: "macro" },
      protein: { label: "Protein", target: 32, unit: "g", category: "macro" },
      karbohidrat: {
        label: "Karbohidrat",
        target: 95,
        unit: "g",
        category: "macro",
      },
      lemak: { label: "Lemak", target: 24, unit: "g", category: "macro" },
      serat: { label: "Serat", target: 11, unit: "g", category: "micro" },
      gula: { label: "Gula", target: 15, unit: "g", category: "micro", limitOnly: true },
      "vitamin a": { label: "Vitamin A", target: 255, unit: "mcg", category: "micro" },
      "vitamin c": { label: "Vitamin C", target: 30, unit: "mg", category: "micro" },
      "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg", category: "micro" },
      kalsium: { label: "Kalsium", target: 360, unit: "mg", category: "micro" },
      "zat besi": { label: "Zat Besi", target: 5.4, unit: "mg", category: "micro" },
      zinc: { label: "Zinc", target: 3.9, unit: "mg", category: "micro" },
      folat: { label: "Folat", target: 150, unit: "mcg", category: "micro" },
      natrium: { label: "Natrium", target: 450, unit: "mg", category: "micro", limitOnly: true },
      kalium: { label: "Kalium", target: 1530, unit: "mg", category: "micro" },
      "omega 3": { label: "Omega-3", target: 0.42, unit: "g", category: "micro" },
    },
  },
  lansia: {
    label: "Lansia",
    focus:
      "protein per porsi, serat, natrium, kalsium, vitamin D, dan lemak tidak berlebih",
    nutrients: {
      kalori: { label: "Kalori", target: 520, unit: "kkal", category: "macro" },
      protein: { label: "Protein", target: 24, unit: "g", category: "macro" },
      karbohidrat: {
        label: "Karbohidrat",
        target: 70,
        unit: "g",
        category: "macro",
      },
      lemak: { label: "Lemak", target: 16, unit: "g", category: "macro" },
      serat: { label: "Serat", target: 9, unit: "g", category: "micro" },
      gula: { label: "Gula", target: 10, unit: "g", category: "micro", limitOnly: true },
      "vitamin a": { label: "Vitamin A", target: 180, unit: "mcg", category: "micro" },
      "vitamin c": { label: "Vitamin C", target: 22.5, unit: "mg", category: "micro" },
      "vitamin d": { label: "Vitamin D", target: 6, unit: "mcg", category: "micro" },
      kalsium: { label: "Kalsium", target: 360, unit: "mg", category: "micro" },
      "zat besi": { label: "Zat Besi", target: 2.4, unit: "mg", category: "micro" },
      zinc: { label: "Zinc", target: 3.3, unit: "mg", category: "micro" },
      folat: { label: "Folat", target: 120, unit: "mcg", category: "micro" },
      natrium: { label: "Natrium", target: 360, unit: "mg", category: "micro", limitOnly: true },
      kalium: { label: "Kalium", target: 1410, unit: "mg", category: "micro" },
      "omega 3": { label: "Omega-3", target: 0.33, unit: "g", category: "micro" },
    },
  },
};

const STANDAR_GIZI = TARGET_AKG_2019.siswa.nutrients;

const NUTRIENT_ALIASES = {
  calorie: "kalori",
  calories: "kalori",
  energi: "kalori",
  energy: "kalori",
  karbo: "karbohidrat",
  carbohydrate: "karbohidrat",
  carbohydrates: "karbohidrat",
  carb: "karbohidrat",
  carbs: "karbohidrat",
  fat: "lemak",
  lipid: "lemak",
  fiber: "serat",
  sugar: "gula",
  "vit a": "vitamin a",
  vitamina: "vitamin a",
  "vitamin_a": "vitamin a",
  "vit c": "vitamin c",
  vitaminc: "vitamin c",
  "vitamin_c": "vitamin c",
  "vit d": "vitamin d",
  vitamind: "vitamin d",
  "vitamin_d": "vitamin d",
  ca: "kalsium",
  calcium: "kalsium",
  fe: "zat besi",
  iron: "zat besi",
  besi: "zat besi",
  seng: "zinc",
  zn: "zinc",
  folate: "folat",
  sodium: "natrium",
  potassium: "kalium",
  omega3: "omega 3",
  "omega-3": "omega 3",
};

function normalizeName(name) {
  const key = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return NUTRIENT_ALIASES[key] || key;
}

function canonicalTargetKey(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "_");

  if (key.includes("balita")) return "balita";
  if (key.includes("hamil")) return "ibu_hamil";
  if (key.includes("menyusui") || key.includes("laktasi")) return "ibu_menyusui";
  if (key.includes("lansia")) return "lansia";
  return "siswa";
}

function convertUnit(value, fromUnit, toUnit) {
  const from = String(fromUnit || toUnit || "").toLowerCase().replace("ug", "mcg");
  const to = String(toUnit || from || "").toLowerCase().replace("ug", "mcg");
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) return 0;
  if (!from || !to || from === to) return numeric;
  if (from === "g" && to === "mg") return numeric * 1000;
  if (from === "mg" && to === "g") return numeric / 1000;
  if (from === "mg" && to === "mcg") return numeric * 1000;
  if (from === "mcg" && to === "mg") return numeric / 1000;
  if (from === "g" && to === "mcg") return numeric * 1000000;
  if (from === "mcg" && to === "g") return numeric / 1000000;
  return numeric;
}

function inferStatus(percent, limitOnly = false) {
  if (limitOnly) {
    if (percent <= 100) return { label: STATUS.optimal, severity: "success" };
    if (percent <= 120) return { label: STATUS.mulaiBerlebih, severity: "warning" };
    return { label: STATUS.terlaluBerlebih, severity: "danger" };
  }

  if (percent < 70) return { label: STATUS.kurang, severity: "warning" };
  if (percent < 90) return { label: STATUS.cukup, severity: "warning" };
  if (percent <= 110) return { label: STATUS.optimal, severity: "success" };
  if (percent <= 120) return { label: STATUS.mulaiBerlebih, severity: "warning" };
  return { label: STATUS.terlaluBerlebih, severity: "danger" };
}

function buildNutrition(nutrition = {}, manualNutrients = []) {
  const result = {};

  ["kalori", "protein", "lemak", "karbohidrat", "serat"].forEach((key) => {
    const value = Number(nutrition[key] || 0);
    if (Number.isFinite(value) && value > 0) {
      result[key] = {
        value,
        unit: key === "kalori" ? "kkal" : "g",
        source: "menu_nutrition",
      };
    }
  });

  if (nutrition.micronutrients && typeof nutrition.micronutrients === "object") {
    Object.entries(nutrition.micronutrients).forEach(([name, value]) => {
      const key = normalizeName(name);
      const numeric = Number(value || 0);
      if (key && numeric > 0) {
        result[key] = { value: numeric, unit: "", source: "micronutrients" };
      }
    });
  }

  manualNutrients.forEach((item) => {
    const key = normalizeName(item.nama || item.name || item.label);
    const numeric = Number(item.nilai ?? item.value ?? 0);
    if (!key || !Number.isFinite(numeric) || numeric <= 0) return;

    if (!result[key]) {
      result[key] = {
        value: 0,
        unit: item.satuan || item.unit || "g",
        source: "manual",
        original_label: item.nama || item.name || item.label,
      };
    }

    result[key].value += numeric;
  });

  return result;
}

function computeNutrientAnalysis(nutrition, targetKey) {
  const target = TARGET_AKG_2019[targetKey] || TARGET_AKG_2019.siswa;
  const analysis = {};
  const nutrientIssues = [];
  const warnings = [];
  let totalScore = 0;
  let maxScore = 0;

  Object.entries(nutrition).forEach(([key, data]) => {
    const standard = target.nutrients[key];
    const fallbackLabel =
      data.original_label ||
      key.replace(/\b\w/g, (char) => char.toUpperCase()).replace("Omega 3", "Omega-3");
    const unit = standard?.unit || data.unit || "";
    const value = standard
      ? convertUnit(data.value, data.unit, standard.unit)
      : Number(data.value || 0);

    if (!Number.isFinite(value) || value <= 0) return;

    if (!standard) {
      analysis[key] = {
        label: fallbackLabel,
        value,
        unit,
        min: 0,
        max: 0,
        target: null,
        percent: null,
        status: STATUS.tercatat,
        score: 100,
        category: key in STANDAR_GIZI ? "macro" : "micro",
      };
      return;
    }

    const percent =
      standard.target > 0 ? Math.round((value / standard.target) * 100) : 0;
    const status = inferStatus(percent, Boolean(standard.limitOnly));
    const score = standard.limitOnly
      ? percent <= 100
        ? 100
        : Math.max(0, Math.round(100 - (percent - 100) * 1.5))
      : Math.max(0, Math.min(100, percent <= 100 ? percent : 100 - (percent - 100)));

    analysis[key] = {
      label: standard.label,
      value: Math.round(value * 10) / 10,
      unit: standard.unit,
      min: Math.round(standard.target * 0.9 * 10) / 10,
      max: Math.round(standard.target * 1.1 * 10) / 10,
      target: standard.target,
      percent,
      status: status.label,
      score: Math.max(0, Math.min(100, score)),
      category: standard.category,
      limit_only: Boolean(standard.limitOnly),
    };

    totalScore += Math.max(0, Math.min(100, score));
    maxScore += 100;

    if (status.severity !== "success") {
      nutrientIssues.push({
        key,
        label: standard.label,
        status: status.label,
        severity: status.severity,
        value: Math.round(value * 10) / 10,
        unit: standard.unit,
        target: standard.target,
        percent,
        category: standard.category,
        limitOnly: Boolean(standard.limitOnly),
      });
    }
  });

  const core = ["kalori", "protein", "karbohidrat", "lemak"];
  const availableCore = core.filter((key) => analysis[key]);
  const availableMicro = Object.values(analysis).filter(
    (item) => item.category === "micro",
  );

  if (availableCore.length < 4) {
    warnings.push(
      "Data makronutrien belum lengkap. Hasil AI bersifat sementara dan belum bisa dianggap final.",
    );
  }

  if (availableMicro.length === 0) {
    warnings.push(
      "Data mikronutrien belum tersedia. Tambahkan vitamin/mineral manual agar analisis ahli gizi lebih utuh.",
    );
  }

  const overallScore =
    maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  let overallStatus = STATUS.optimal;
  if (warnings.length > 0) overallStatus = "Data Belum Lengkap";
  else if (overallScore < 70) overallStatus = STATUS.kurang;
  else if (overallScore < 90) overallStatus = STATUS.cukup;
  else if (overallScore > 120) overallStatus = STATUS.terlaluBerlebih;
  else if (overallScore > 110) overallStatus = STATUS.mulaiBerlebih;

  return {
    analysis,
    overallScore,
    overallStatus,
    nutrientIssues,
    warnings,
    target,
  };
}

function getMacroDistribution(analysis) {
  const protein = Number(analysis.protein?.value || 0) * 4;
  const karbo = Number(analysis.karbohidrat?.value || 0) * 4;
  const lemak = Number(analysis.lemak?.value || 0) * 9;
  const total = protein + karbo + lemak;

  if (total <= 0) return null;

  return {
    protein_pct: Math.round((protein / total) * 100),
    karbohidrat_pct: Math.round((karbo / total) * 100),
    lemak_pct: Math.round((lemak / total) * 100),
  };
}

function buildPrompt(
  namaMenu,
  target,
  analysis,
  nutrientIssues,
  overallScore,
  overallStatus,
  macroDistribution,
  warnings,
  menuRole,
) {
  const nutritionLines = Object.values(analysis)
    .map((item) => {
      const targetText = item.target
        ? `target ${item.target} ${item.unit}, ${item.percent}%`
        : "target AKG tidak tersedia";
      return `- ${item.label}: ${item.value} ${item.unit} (${targetText}, status ${item.status})`;
    })
    .join("\n");

  const issuesText =
    nutrientIssues.length > 0
      ? nutrientIssues
          .map(
            (i) =>
              `- ${i.label}: ${i.value} ${i.unit}, target ${i.target} ${i.unit}, ${i.percent}%, status ${i.status}`,
          )
          .join("\n")
      : "- Tidak ada isu besar pada nutrien yang tersedia.";

  const distributionText = macroDistribution
    ? `Protein ${macroDistribution.protein_pct}%, karbohidrat ${macroDistribution.karbohidrat_pct}%, lemak ${macroDistribution.lemak_pct}% dari energi makro.`
    : "Distribusi makro belum bisa dihitung.";

  const warningText =
    warnings.length > 0 ? warnings.map((w) => `- ${w}`).join("\n") : "- Data cukup untuk analisis.";
  const isSupportDrink = menuRole === "support_drink";
  const menuRoleText = isSupportDrink
    ? "Minuman/menu pendukung (contoh susu), bukan menu utama lengkap. Nilai sebagai pelengkap gizi."
    : "Menu utama/lauk-pangan yang dinilai sebagai porsi MBG mandiri.";
  const drinkRules = isSupportDrink
    ? `
Aturan khusus minuman pendukung:
- Jangan memaksa minuman seperti susu memenuhi target energi/makro menu utama sendirian.
- Fokus pada kontribusi pendukung: protein, kalsium, vitamin/mineral, gula, lemak, keamanan porsi.
- Kekurangan kalori/karbo/serat boleh disebut wajar untuk minuman pendukung.
- Rekomendasi harus berupa cara memasangkan dengan menu utama, bukan menaikkan porsi minuman berlebihan.`
    : "";

  return `Kamu adalah ahli gizi profesional program MBG Indonesia. Analisis menu sebagai nutrition reasoning engine, bukan komentar generik.

DATA
Nama menu: ${namaMenu}
Peran menu: ${menuRoleText}
Target: ${target.label}
Fokus target: ${target.focus}
Skor: ${overallScore}/100
Status: ${overallStatus}
Distribusi makro: ${distributionText}

Zat gizi tersedia:
${nutritionLines}

Isu berbasis data:
${issuesText}

Peringatan kelengkapan data:
${warningText}

Balas HANYA JSON valid:
{
  "message": "1-2 kalimat evaluasi berbasis data",
  "catatan": "insight utama masalah menu, spesifik menyebut nutrien dan alasan",
  "tips": "saran praktis koreksi komposisi menu",
  "kesimpulan": "ringkasan singkat, tegas, profesional untuk ahli gizi",
  "recommendations": [
    {
      "jenis": "Gizi",
      "nutrient": "nama zat gizi atau null",
      "severity": "success|warning|danger",
      "pesan": "rekomendasi spesifik berbasis angka",
      "detail": "nilai vs target, atau null"
    }
  ]
}

Aturan:
- Jangan tulis generik seperti menu baik/menu sehat tanpa alasan.
- Kaitkan analisis dengan target ${target.label}.
- Bahas energi, distribusi makro, dominasi zat gizi, dan mikro yang tersedia.
- Jika data belum lengkap, nyatakan analisis sementara.
- Maksimal 5 rekomendasi paling penting.${drinkRules}`;
}

async function callGeminiAPI(payload) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di file .env");
  }

  if (apiKey.length < 20) {
    throw new Error("GEMINI_API_KEY tampak tidak valid");
  }

  const prompt = buildPrompt(...payload);

  const result = await retryWithBackoff(
    async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0.45,
          topP: 0.9,
          maxOutputTokens: 1400,
        },
      });

      const response = await model.generateContent(prompt);
      return response.response.text().trim();
    },
    {
      maxRetries: 0,
      initialDelay: 1500,
      backoffMultiplier: 2,
      name: "Gemini nutrition reasoning",
    },
  );

  const parsed = extractJsonFromText(result);
  if (!parsed.message || !Array.isArray(parsed.recommendations)) {
    throw new Error("Respons Gemini tidak memiliki struktur yang diharapkan");
  }

  return normalizeAiOutput(parsed);
}

function getOpenAIOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }

  return chunks.join("\n").trim();
}

async function callOpenAIAPI(payload) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "your_openai_api_key_here") {
    throw new Error("OPENAI_API_KEY belum dikonfigurasi di file .env");
  }

  if (apiKey.length < 20) {
    throw new Error("OPENAI_API_KEY tampak tidak valid");
  }

  const prompt = buildPrompt(...payload);
  const model = process.env.OPENAI_MODEL || "gpt-5.2";
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      message: { type: "string" },
      catatan: { type: "string" },
      tips: { type: "string" },
      kesimpulan: { type: "string" },
      recommendations: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            jenis: { type: "string" },
            nutrient: { type: ["string", "null"] },
            severity: { type: "string", enum: ["success", "warning", "danger"] },
            pesan: { type: "string" },
            detail: { type: ["string", "null"] },
          },
          required: ["jenis", "nutrient", "severity", "pesan", "detail"],
        },
      },
    },
    required: ["message", "catatan", "tips", "kesimpulan", "recommendations"],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "Kamu ahli gizi MBG Indonesia. Balas hanya JSON valid sesuai schema.",
        },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "nutrition_reasoning_output",
          strict: true,
          schema,
        },
      },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `OpenAI API gagal (${response.status})`;
    throw new Error(message);
  }

  const text = getOpenAIOutputText(data);
  const parsed = extractJsonFromText(text);
  if (!parsed.message || !Array.isArray(parsed.recommendations)) {
    throw new Error("Respons OpenAI tidak memiliki struktur yang diharapkan");
  }

  return {
    ...normalizeAiOutput(parsed),
    model,
  };
}

async function callDeepSeekAPI(payload) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey || apiKey === "your_deepseek_api_key_here") {
    throw new Error("DEEPSEEK_API_KEY belum dikonfigurasi di file .env");
  }

  if (apiKey.length < 20) {
    throw new Error("DEEPSEEK_API_KEY tampak tidak valid");
  }

  const prompt = buildPrompt(...payload);
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Kamu ahli gizi MBG Indonesia. Balas hanya JSON valid sesuai instruksi.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.45,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `DeepSeek API gagal (${response.status})`;
    throw new Error(message);
  }

  const text = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJsonFromText(text);
  if (!parsed.message || !Array.isArray(parsed.recommendations)) {
    throw new Error("Respons DeepSeek tidak memiliki struktur yang diharapkan");
  }

  return {
    ...normalizeAiOutput(parsed),
    model,
  };
}

function hasConfiguredEnv(name, placeholder) {
  const value = process.env[name];
  return Boolean(value && value !== placeholder);
}

function normalizeAiOutput(parsed) {
  const validSeverities = new Set(["success", "warning", "danger"]);
  return {
    message: parsed.message,
    catatan: parsed.catatan || parsed.message,
    tips: parsed.tips || parsed.recommendations?.[0]?.pesan || parsed.message,
    kesimpulan: parsed.kesimpulan || parsed.message,
    recommendations: (parsed.recommendations || []).map((rec) => ({
      jenis: rec.jenis || "Gizi",
      nutrient: rec.nutrient || null,
      severity: validSeverities.has(rec.severity) ? rec.severity : "warning",
      pesan: rec.pesan || "",
      detail: rec.detail || null,
    })),
  };
}

function formatIssue(issue) {
  return `${issue.label} ${issue.value} ${issue.unit} dari target ${issue.target} ${issue.unit} (${issue.percent}%)`;
}

function inferMenuRole(namaMenu, menuContext = {}) {
  const text = `${namaMenu || ""} ${menuContext.deskripsi || ""}`.toLowerCase();
  const explicitType = String(menuContext.menuType || menuContext.menu_type || "").toLowerCase();
  const isDrink =
    explicitType === "minuman" ||
    ["minum", "minuman", "jus", "teh", "susu", "smoothie", "sirup", "wedang"].some((keyword) =>
      text.includes(keyword),
    );
  const isSupportDrink = isDrink && ["susu", "milk", "yoghurt", "yogurt", "jus", "smoothie"].some((keyword) => text.includes(keyword));

  return isSupportDrink ? "support_drink" : isDrink ? "drink" : "main_menu";
}

function buildFallbackResult(namaMenu, target, nutrientIssues, analysis, warnings, menuRole) {
  const macroDistribution = getMacroDistribution(analysis);
  const sortedIssues = [...nutrientIssues].sort((a, b) => {
    const weight = { danger: 3, warning: 2, success: 1 };
    return (weight[b.severity] || 0) - (weight[a.severity] || 0);
  });
  const primaryIssue = sortedIssues[0];
  const macroIssues = sortedIssues.filter((i) => i.category === "macro");
  const microIssues = sortedIssues.filter((i) => i.category === "micro");
  const filteredIssues =
    menuRole === "support_drink"
      ? sortedIssues.filter(
          (issue) => !["kalori", "karbohidrat", "serat"].includes(issue.label.toLowerCase()),
        )
      : sortedIssues;
  const recommendations = filteredIssues.slice(0, 5).map((issue) => {
    const isHigh =
      issue.status === STATUS.mulaiBerlebih ||
      issue.status === STATUS.terlaluBerlebih;
    const action = isHigh
      ? `Kurangi sumber ${issue.label.toLowerCase()} atau seimbangkan dengan sayur/komponen rendah energi.`
      : `Tingkatkan ${issue.label.toLowerCase()} melalui bahan lokal yang sesuai target ${target.label}.`;

    return {
      jenis: "Gizi",
      nutrient: issue.label,
      severity: issue.severity,
      pesan: `[${issue.label}] ${action}`,
      detail: formatIssue(issue),
    };
  });

  if (recommendations.length === 0) {
    recommendations.push({
      jenis: "Gizi",
      nutrient: null,
      severity: "success",
      pesan:
        menuRole === "support_drink"
          ? `"${namaMenu}" layak sebagai menu pendukung untuk target ${target.label} pada data yang tersedia.`
          : `Komposisi "${namaMenu}" berada dalam rentang optimal untuk target ${target.label} pada data yang tersedia.`,
      detail: null,
    });
  }

  const warningPrefix =
    warnings.length > 0 ? "Data belum lengkap, sehingga analisis masih sementara. " : "";
  const macroText = macroDistribution
    ? `Distribusi energi makro: protein ${macroDistribution.protein_pct}%, karbohidrat ${macroDistribution.karbohidrat_pct}%, lemak ${macroDistribution.lemak_pct}%.`
    : "Distribusi makro belum dapat dihitung.";
  const issueText = primaryIssue
    ? `Masalah utama: ${formatIssue(primaryIssue)} dengan status ${primaryIssue.status}.`
    : "Tidak ada ketimpangan besar pada zat gizi yang tersedia.";
  const microText =
    microIssues.length > 0
      ? `Mikronutrien perlu perhatian: ${microIssues
          .slice(0, 3)
          .map((i) => i.label)
          .join(", ")}.`
      : "Mikronutrien yang tersedia tidak menunjukkan masalah besar.";
  const macroDominance =
    menuRole === "support_drink"
      ? "Sebagai minuman pendukung, nilai utama ada pada kontribusi protein, kalsium, vitamin/mineral, dan kontrol gula."
      : macroDistribution && macroDistribution.karbohidrat_pct >= 65
      ? "Karbohidrat tampak dominan, jadi porsi lauk protein dan sayur perlu dicek."
      : macroDistribution && macroDistribution.lemak_pct >= 35
        ? "Lemak relatif dominan, metode masak dan sumber minyak perlu dikendalikan."
        : macroDistribution && macroDistribution.protein_pct < 12
          ? "Kontribusi protein relatif rendah dibanding energi makro."
          : "Distribusi makro relatif terkendali pada data yang tersedia.";

  return {
    message:
      menuRole === "support_drink"
        ? `${warningPrefix}Menu ini terbaca sebagai minuman pendukung. ${issueText} ${macroText}`
        : `${warningPrefix}${issueText} ${macroText}`,
    catatan:
      menuRole === "support_drink"
        ? `${issueText} ${macroDominance} Kekurangan energi total masih bisa wajar bila dipasangkan dengan menu utama. Fokus ${target.label}: ${target.focus}.`
        : `${issueText} ${macroDominance} Fokus ${target.label}: ${target.focus}.`,
    tips:
      menuRole === "support_drink"
        ? "Pasangkan minuman ini dengan menu utama sumber energi, lauk protein, dan sayur; evaluasi terutama protein, kalsium, dan gula minuman."
        : macroIssues.length > 0
        ? recommendations[0].pesan.replace(/^\[[^\]]+\]\s*/, "")
        : `${microText} Lengkapi data vitamin/mineral agar koreksi menu lebih presisi.`,
    kesimpulan:
      menuRole === "support_drink"
        ? `${warningPrefix}${namaMenu} lebih tepat dinilai sebagai menu pendukung, bukan menu utama mandiri, untuk target ${target.label}.`
        : `${warningPrefix}${namaMenu} ${
            primaryIssue ? "perlu koreksi komposisi sebelum dinyatakan optimal" : "sudah layak pada data yang tersedia"
          } untuk target ${target.label}.`,
    recommendations,
  };
}

async function analyzeNutrition(nutrition, namaMenu, menuContext = {}) {
  const menuRole = inferMenuRole(namaMenu, menuContext);
  const targetKey = canonicalTargetKey(
    menuContext.targetKey || menuContext.target || menuContext.kategori,
  );
  const mergedNutrition = buildNutrition(
    nutrition,
    menuContext.manualNutrients || menuContext.manual_macronutrients || [],
  );
  const {
    analysis,
    overallScore,
    overallStatus,
    nutrientIssues,
    warnings,
    target,
  } = computeNutrientAnalysis(mergedNutrition, targetKey);
  const macroDistribution = getMacroDistribution(analysis);

  let aiOutput;
  let poweredBy = "OpenAI";
  let aiEngine = process.env.OPENAI_MODEL || "gpt-5.2";

  try {
    const payload = [
      namaMenu,
      target,
      analysis,
      nutrientIssues,
      overallScore,
      overallStatus,
      macroDistribution,
      warnings,
      menuRole,
    ];

    const providers = [
      {
        name: "OpenAI Responses API",
        engine: process.env.OPENAI_MODEL || "gpt-5.2",
        configured: hasConfiguredEnv("OPENAI_API_KEY", "your_openai_api_key_here"),
        run: callOpenAIAPI,
      },
      {
        name: "Google Gemini AI",
        engine: "gemini-2.5-flash-lite",
        configured: hasConfiguredEnv("GEMINI_API_KEY", "your_gemini_api_key_here"),
        run: callGeminiAPI,
      },
      {
        name: "DeepSeek AI",
        engine: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        configured: hasConfiguredEnv(
          "DEEPSEEK_API_KEY",
          "your_deepseek_api_key_here",
        ),
        run: callDeepSeekAPI,
      },
    ];
    const providerErrors = [];

    for (const provider of providers) {
      if (!provider.configured) {
        providerErrors.push(`${provider.name}: API key belum dikonfigurasi`);
        continue;
      }

      try {
        aiOutput = await provider.run(payload);
        aiEngine = aiOutput.model || provider.engine;
        poweredBy = provider.name;
        break;
      } catch (providerError) {
        const message = providerError?.message || "gagal tanpa detail";
        providerErrors.push(`${provider.name}: ${message}`);
        console.warn(`[AI Nutrition] ${provider.name} failed: ${message}`);
      }
    }

    if (!aiOutput) {
      throw new Error(providerErrors.join(" | "));
    }
  } catch (err) {
    const msg = err.message || "";
    if (menuContext.requireAi || menuContext.requireGemini) {
      throw new Error(
        `AI API tidak tersedia untuk analisis dashboard: ${msg}`,
      );
    }
    console.warn(`[AI Nutrition] provider fallback: ${msg}`);
    aiOutput = buildFallbackResult(
      namaMenu,
      target,
      nutrientIssues,
      analysis,
      warnings,
      menuRole,
    );
    poweredBy = "Rule-Based Nutrition Reasoning";
    aiEngine = "rule-based-nutrition-reasoning";
  }

  return {
    menu_nama: namaMenu,
    skor_gizi: overallScore,
    status: overallStatus,
    pesan: aiOutput.message,
    catatan_ai: aiOutput.catatan,
    tips_ai: aiOutput.tips,
    kesimpulan_ai: aiOutput.kesimpulan,
    detail_analisis: analysis,
    rekomendasi: aiOutput.recommendations,
    standar_referensi: `AKG 2019 target ${target.label} per porsi MBG - Powered by ${poweredBy}`,
    target_key: targetKey,
    target_label: target.label,
    target_focus: target.focus,
    menu_role: menuRole,
    macro_distribution: macroDistribution,
    data_quality: {
      is_complete: warnings.length === 0,
      warnings,
    },
    ai_engine: aiEngine,
    analyzed_at: new Date().toISOString(),
  };
}

function getNutritionSummary(nutrition) {
  return {
    kalori: Number(nutrition.kalori || 0),
    protein: Number(nutrition.protein || 0),
    lemak: Number(nutrition.lemak || 0),
    karbohidrat: Number(nutrition.karbohidrat || 0),
    serat: Number(nutrition.serat || 0),
    is_balanced: isBalanced(nutrition),
  };
}

function normalizeMaterialName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function alignMenuNameWithMethod(name, method) {
  const cleanName = String(name || "Menu MBG").trim() || "Menu MBG";
  const cleanMethod = String(method || "kukus").toLowerCase().trim() || "kukus";
  const methodWords = ["goreng", "tumis", "rebus", "kukus", "bakar"];
  const wrongWords = methodWords.filter((word) => word !== cleanMethod);
  let alignedName = cleanName;
  wrongWords.forEach((word) => {
    const re = new RegExp(`\b${word}\b`, "gi");
    alignedName = alignedName.replace(re, cleanMethod);
  });
  if (!new RegExp(`\b${cleanMethod}\b`, "i").test(alignedName)) {
    alignedName = `${cleanMethod.charAt(0).toUpperCase()}${cleanMethod.slice(1)} ${alignedName}`;
  }
  return alignedName.replace(/\s+/g, " ").trim();
}

function enrichGeneratedIngredients(generatedIngredients, sourceIngredients) {
  const sourceById = new Map();
  const sourceByName = new Map();
  (sourceIngredients || []).forEach((item) => {
    if (item.raw_material_id) sourceById.set(String(item.raw_material_id), item);
    const key = normalizeMaterialName(item.nama || item.nama_bahan || item.name);
    if (key) sourceByName.set(key, item);
  });

  return (generatedIngredients || []).map((item) => {
    const source =
      sourceById.get(String(item.raw_material_id || "")) ||
      sourceByName.get(normalizeMaterialName(item.nama || item.nama_bahan || item.name));
    return {
      ...item,
      nama: item.nama || source?.nama || source?.nama_bahan || source?.name || "Bahan",
      raw_material_id: item.raw_material_id || source?.raw_material_id || source?.id || null,
      harga_satuan: Number(item.harga_satuan ?? source?.harga_satuan ?? source?.standard_price ?? 0),
      qty_available: item.qty_available ?? source?.qty_available ?? null,
      satuan: item.satuan || source?.satuan || source?.unit || "g",
    };
  });
}

function isBalanced(nutrition, targetKey = "siswa") {
  const merged = buildNutrition(nutrition, []);
  const { nutrientIssues, warnings } = computeNutrientAnalysis(
    merged,
    targetKey,
  );
  return nutrientIssues.length === 0 && warnings.length === 0;
}

async function generateMenuFromIngredients(
  ingredients,
  kelompok = "Siswa",
  kategori = "Siswa",
  caraMasak = "kukus",
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const canUseGemini = apiKey && apiKey !== "your_gemini_api_key_here";
  const cleanCaraMasak = String(caraMasak || "kukus").trim().toLowerCase();

  const TARGET_GIZI = {
    balita: { kalori: "400-500", protein: "15-20", lemak: "12-18", karbo: "55-70" },
    siswa: { kalori: "550-650", protein: "20-30", lemak: "15-22", karbo: "70-90" },
    ibu_hamil: { kalori: "700-800", protein: "25-35", lemak: "20-28", karbo: "80-100" },
    ibu_menyusui: { kalori: "750-850", protein: "30-38", lemak: "22-30", karbo: "90-110" },
  };
  const targetKey = String(kategori || kelompok || "Siswa")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const target = TARGET_GIZI[targetKey] || TARGET_GIZI.siswa;

  const ingList = ingredients
    .map((i) => `- ${i.nama} (${i.jumlah} ${i.satuan})`)
    .join("\n");

  const prompt = `Kamu adalah ahli gizi program MBG Indonesia. Buat satu rekomendasi menu dari bahan tersedia.

BAHAN:
${ingList}

TARGET PENERIMA ${kategori}:
- Kalori: ${target.kalori} kkal
- Protein: ${target.protein} g
- Lemak: ${target.lemak} g
- Karbohidrat: ${target.karbo} g

Kategori penerima: ${kategori}
Cara masak wajib: ${cleanCaraMasak}
Nama menu WAJIB memuat kata metode "${cleanCaraMasak}" dan tidak boleh memuat metode lain. Contoh: jika metode tumis, buat "Tumis ...", bukan "Nasi Goreng".
Buat hanya menu MAKANAN, bukan minuman. Jangan membuat susu, jus, smoothie, teh, atau menu minuman lain. Jika ada bahan susu, perlakukan hanya sebagai catatan bahan tersedia dan jangan jadikan menu minuman.
Pilih kombinasi bahan baku API yang cocok untuk makanan utama/lauk/sayur. Perhitungkan metode masak: goreng biasanya menaikkan kalori/lemak; kukus/rebus lebih rendah lemak; bakar/tumis sedang.

Balas JSON valid:
{
  "nama_menu": "nama menu",
  "deskripsi": "deskripsi singkat",
  "metode_masak": "goreng/kukus/rebus/bakar/tumis",
  "catatan_metode_masak": "jelaskan singkat dampak metode masak terhadap kalori",
  "estimasi_gizi": {
    "kalori": number,
    "protein": number,
    "lemak": number,
    "karbohidrat": number,
    "serat": number
  },
  "bahan_digunakan": [
    { "raw_material_id": "id dari daftar bahan", "nama": "nama bahan", "jumlah": number, "satuan": "satuan", "harga_satuan": number, "catatan": "opsional" }
  ],
  "bahan_kurang": [
    { "nama": "nama bahan", "jumlah_butuh": number, "satuan": "satuan", "alasan": "kenapa dibutuhkan" }
  ],
  "tips_gizi": "satu kalimat tip gizi",
  "sesuai_target": true
}`;

  if (canUseGemini) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
    });

    const result = await model.generateContent(prompt);
    const parsed = extractJsonFromText(result.response.text().trim());
    const bahanDigunakan = enrichGeneratedIngredients(parsed.bahan_digunakan, ingredients);
    return {
      ...parsed,
      nama_menu: alignMenuNameWithMethod(parsed.nama_menu, cleanCaraMasak),
      metode_masak: cleanCaraMasak,
      bahan_digunakan: bahanDigunakan,
      kelompok,
      kategori,
      jenis_menu: "makanan",
      generated_at: new Date().toISOString(),
    };
  }

  const bahanUtama = ingredients.slice(0, 5).map((i) => ({
    nama: i.nama,
    jumlah: Number(i.jumlah || 0),
    satuan: i.satuan || "g",
  }));
  const fallbackByKelompok = {
    balita: { kalori: 470, protein: 19, lemak: 15, karbo: 62 },
    siswa: { kalori: 610, protein: 26, lemak: 18, karbo: 82 },
    ibu_hamil: { kalori: 760, protein: 32, lemak: 24, karbo: 95 },
    ibu_menyusui: { kalori: 840, protein: 36, lemak: 26, karbo: 102 },
    porsi_kecil: { kalori: 430, protein: 18, lemak: 14, karbo: 60 },
    porsi_besar: { kalori: 810, protein: 34, lemak: 24, karbo: 98 },
  };

  const fallbackTarget =
    fallbackByKelompok[targetKey] || fallbackByKelompok[kelompok] || fallbackByKelompok.siswa;

  return {
    nama_menu: alignMenuNameWithMethod(`Menu MBG ${kategori} Berbasis Stok`, cleanCaraMasak),
    deskripsi:
      "Menu makanan rekomendasi sementara dari bahan baku API. Aktifkan GEMINI_API_KEY untuk hasil generatif penuh.",
    metode_masak: cleanCaraMasak,
    estimasi_gizi: {
      kalori: fallbackTarget.kalori,
      protein: fallbackTarget.protein,
      lemak: fallbackTarget.lemak,
      karbohidrat: fallbackTarget.karbo,
      serat: 6,
    },
    bahan_digunakan: enrichGeneratedIngredients(bahanUtama, ingredients),
    bahan_kurang: [],
    tips_gizi:
      "Tambahkan sayur hijau dan buah untuk melengkapi komposisi isi piringku.",
    sesuai_target: true,
    kelompok,
    kategori,
    jenis_menu: "makanan",
    generated_at: new Date().toISOString(),
    source: "api-material-fallback",
  };
}

module.exports = {
  analyzeNutrition,
  getNutritionSummary,
  isBalanced,
  generateMenuFromIngredients,
  STANDAR_GIZI,
  TARGET_AKG_2019,
};
