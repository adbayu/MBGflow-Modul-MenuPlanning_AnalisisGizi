import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Baby,
  Brain,
  CheckCircle2,
  Heart,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { Menu, AIAnalysisResult, MenuNutrition } from "../types";
import { MENU_API_URL } from "../config/api";

const API = MENU_API_URL;

async function readJsonResponse<T>(res: Response, fallbackMessage: string) {
  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `${fallbackMessage}. Server mengirim respons non-JSON (${res.status}).`,
      );
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : fallbackMessage;
    throw new Error(message);
  }

  return data as T;
}

const PILLAR_COLORS: Record<string, string> = {
  kalori: "#2e7d32",
  protein: "#16a34a",
  lemak: "#f59e0b",
  karbohidrat: "#60a5fa",
  serat: "#14b8a6",
};

type TargetMBG = "siswa" | "balita" | "ibu_hamil";

const TARGET_MBG_OPTIONS: {
  key: TargetMBG;
  label: string;
  icon: typeof Users;
  sublabel: string;
}[] = [
  { key: "balita", label: "Balita", icon: Baby, sublabel: "Usia 2-5 tahun" },
  { key: "siswa", label: "Siswa", icon: Users, sublabel: "Usia 6-18 tahun" },
  {
    key: "ibu_hamil",
    label: "Ibu Hamil",
    icon: Heart,
    sublabel: "Trimester 1-3",
  },
];

const AKG_MINIMUM: Record<TargetMBG, Record<string, number>> = {
  balita: {
    kalori: 400,
    protein: 15,
    lemak: 12,
    karbohidrat: 55,
    serat: 3,
  },
  siswa: {
    kalori: 550,
    protein: 20,
    lemak: 15,
    karbohidrat: 70,
    serat: 5,
  },
  ibu_hamil: {
    kalori: 700,
    protein: 25,
    lemak: 20,
    karbohidrat: 80,
    serat: 6,
  },
};

const AKG_MAXIMUM: Record<TargetMBG, Record<string, number>> = {
  balita: {
    kalori: 500,
    protein: 20,
    lemak: 18,
    karbohidrat: 70,
    serat: 8,
  },
  siswa: {
    kalori: 650,
    protein: 30,
    lemak: 22,
    karbohidrat: 90,
    serat: 10,
  },
  ibu_hamil: {
    kalori: 800,
    protein: 35,
    lemak: 28,
    karbohidrat: 100,
    serat: 12,
  },
};

export default function AILabPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [targetMBG, setTargetMBG] = useState<TargetMBG>("siswa");
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPillar, setHoveredPillar] = useState<string | null>(null);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const runAnalysis = async (menuId: number) => {
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setApplySuccess(null);
    try {
      const res = await fetch(`${API}/${menuId}/analyze`, { method: "POST" });
      const data = await readJsonResponse<AIAnalysisResult>(
        res,
        "Analisis gagal",
      );
      setAnalysis(data as AIAnalysisResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetch(API)
      .then((r) => readJsonResponse<Menu[]>(r, "Gagal memuat menu"))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMenus(list as Menu[]);
        if (list.length > 0) {
          setSelectedMenuId(list[0].id as number);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleApplySuggestion = async (recIdx: number) => {
    if (!selectedMenuId || !analysis) return;
    setApplyingIdx(recIdx);
    setApplySuccess(null);

    try {
      const detailRes = await fetch(`${API}/${selectedMenuId}`);
      const detail = await readJsonResponse<Menu>(
        detailRes,
        "Gagal mengambil data menu",
      );

      const currentNutrition = (detail.nutrition || {}) as Partial<MenuNutrition>;
      const akgMin = AKG_MINIMUM[targetMBG];
      const akgMax = AKG_MAXIMUM[targetMBG];
      const rec = analysis.rekomendasi[recIdx];
      const updatedNutrition = { ...currentNutrition };

      if (rec.nutrient) {
        const key = rec.nutrient.toLowerCase();
        const nutritionKey = key === "karbohidrat" ? "karbohidrat" : key;
        if (nutritionKey in akgMin) {
          const typedKey = nutritionKey as keyof typeof akgMin;
          const nutritionValues = updatedNutrition as Record<
            string,
            number | undefined
          >;
          const currentVal = Number(nutritionValues[nutritionKey] || 0);
          const min = akgMin[typedKey];
          const max = akgMax[typedKey];
          const target = Math.round((min + max) / 2);

          if (rec.severity === "warning" && currentVal < min) {
            (updatedNutrition as Record<string, number>)[nutritionKey] = target;
          } else if (rec.severity === "danger" && currentVal > max) {
            (updatedNutrition as Record<string, number>)[nutritionKey] = target;
          }
        }
      }

      const putRes = await fetch(`${API}/${selectedMenuId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: detail.nama,
          kategori: detail.kategori,
          deskripsi: detail.deskripsi,
          ingredients: detail.ingredients,
          nutrition: {
            kalori: updatedNutrition.kalori || 0,
            protein: updatedNutrition.protein || 0,
            lemak: updatedNutrition.lemak || 0,
            karbohidrat: updatedNutrition.karbohidrat || 0,
            serat: updatedNutrition.serat || 0,
          },
        }),
      });

      await readJsonResponse(putRes, "Gagal mengupdate nutrisi");

      setApplySuccess(
        `Sugesti "${rec.nutrient || "Umum"}" berhasil diterapkan!`,
      );
      setTimeout(() => runAnalysis(selectedMenuId), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menerapkan sugesti");
    } finally {
      setApplyingIdx(null);
    }
  };

  const totalNutrients = analysis
    ? Object.keys(analysis.detail_analisis).length
    : 6;
  const optimalCount = analysis
    ? Object.values(analysis.detail_analisis).filter(
        (d) => d.status === "optimal",
      ).length
    : 0;
  const warningCount = analysis
    ? Object.values(analysis.detail_analisis).filter(
        (d) => d.status !== "optimal",
      ).length
    : 0;

  const akgMin = AKG_MINIMUM[targetMBG];
  const akgMax = AKG_MAXIMUM[targetMBG];
  const selectedMenu = menus.find((m) => m.id === selectedMenuId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="page-shell space-y-6"
    >
      <div className="page-header">
        <div>
          <span className="soft-badge">
            <Sparkles className="h-3.5 w-3.5" />
            AI Analytics
          </span>
          <h1 className="page-title mt-4">AI Nutrition Lab</h1>
          <p className="page-subtitle">
            Analisis mendalam dan rekomendasi optimasi gizi menu MBG.
          </p>
        </div>
      </div>

      {!loading && (
        <div className="card rounded-[30px] p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr_auto] xl:items-end">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                Pilih Menu
              </label>
              <select
                value={selectedMenuId || ""}
                onChange={(e) => {
                  setSelectedMenuId(Number(e.target.value));
                  setAnalysis(null);
                  setError(null);
                  setApplySuccess(null);
                }}
                className="w-full px-4 py-3 text-sm font-medium"
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama} - {m.kategori}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                <Target className="mr-1 inline h-3.5 w-3.5" />
                Target Kelompok MBG
              </label>
              <div className="pill-toggle grid grid-cols-1 sm:grid-cols-3">
                {TARGET_MBG_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setTargetMBG(opt.key);
                        setAnalysis(null);
                        setApplySuccess(null);
                      }}
                      data-active={targetMBG === opt.key}
                      className="flex items-center justify-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => selectedMenuId && runAnalysis(selectedMenuId)}
              disabled={analyzing || !selectedMenuId}
              className="btn-primary flex items-center justify-center gap-2 px-5 py-3.5 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menganalisis...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Mulai Analisis
                </>
              )}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TARGET_MBG_OPTIONS.map((item) => (
              <div
                key={item.key}
                className={`rounded-[22px] border px-4 py-3 ${
                  targetMBG === item.key
                    ? "border-forest-200 bg-forest-50"
                    : "border-ink-100 bg-white/80"
                }`}
              >
                <p className="text-sm font-semibold text-ink-700">
                  {item.label}
                </p>
                <p className="text-xs text-ink-400">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {applySuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
          >
            {applySuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {analyzing ? (
        <div className="card flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-[30px] p-10 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-forest-50 text-forest-800">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <p className="text-base font-semibold text-ink-700">
            AI sedang menganalisis nutrisi "{selectedMenu?.nama}"...
          </p>
          <p className="text-sm text-ink-400">
            Hasil analitik akan tampil di dashboard setelah proses selesai.
          </p>
        </div>
      ) : error ? (
        <div className="card rounded-[30px] p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="mb-4 text-sm text-ink-500">{error}</p>
          <button
            onClick={() => selectedMenuId && runAnalysis(selectedMenuId)}
            className="btn-primary px-6 py-3 text-sm"
          >
            Coba Lagi
          </button>
        </div>
      ) : analysis ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card rounded-[30px] p-6"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-ink-400">
                  Overall Score
                </p>
                <TrendingUp className="h-4 w-4 text-forest-700" />
              </div>
              <p className="text-5xl font-black text-ink-700">
                {analysis.skor_gizi}
                <span className="text-lg font-normal text-ink-400"> /100</span>
              </p>
              <p className="mt-2 text-sm text-ink-400">{analysis.status}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="rounded-[30px] bg-gradient-to-br from-forest-950 via-forest-900 to-forest-700 p-6 text-white shadow-[0_24px_52px_rgba(23,59,35,0.22)]"
            >
              <p className="text-sm font-medium text-white/70">
                Nutrisi Optimal
              </p>
              <p className="mt-2 text-5xl font-black">
                {optimalCount}
                <span className="text-lg font-normal text-white/60">
                  {" "}
                  /{totalNutrients}
                </span>
              </p>
              <p className="mt-2 text-xs text-white/60">Memenuhi target gizi</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="card rounded-[30px] p-6"
            >
              <p className="text-sm font-medium text-ink-400">
                Perlu Perhatian
              </p>
              <p className="mt-2 text-5xl font-black text-amber-600">
                {warningCount}
              </p>
              <p className="mt-2 text-xs text-ink-400">
                Pilar nutrisi di luar rentang target
              </p>
            </motion.div>
          </div>

          <div className="card rounded-[30px] p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink-700">
                  Nutrition Pillar Analysis
                </h3>
                <p className="text-sm text-ink-400">
                  Overlay membandingkan nilai aktual dengan rentang AKG target.
                </p>
              </div>
              <span className="soft-badge">
                AKG {TARGET_MBG_OPTIONS.find((t) => t.key === targetMBG)?.label}
              </span>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-ink-400">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-forest-700" />
                <span>Nilai aktual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm border border-dashed border-emerald-300 bg-emerald-50" />
                <span>Batas minimum</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm border border-dashed border-emerald-300 bg-emerald-50" />
                <span>Rentang ideal</span>
              </div>
            </div>

            <div
              className="flex items-end justify-center gap-4 overflow-x-auto pb-2"
              style={{ height: 240 }}
            >
              {Object.entries(analysis.detail_analisis).map(([key, d]) => {
                const maxVal = Math.max(
                  d.value,
                  akgMax[key] || 100,
                  akgMin[key] || 50,
                );
                const barH = Math.max(12, (d.value / maxVal) * 168);
                const minBarH = Math.max(
                  8,
                  ((akgMin[key] || 0) / maxVal) * 168,
                );
                const maxBarH = Math.max(
                  8,
                  ((akgMax[key] || 100) / maxVal) * 168,
                );
                const color = PILLAR_COLORS[key] || "#2e7d32";
                const isHovered = hoveredPillar === key;
                const statusColor =
                  d.status === "optimal"
                    ? "#2e7d32"
                    : d.status === "rendah"
                      ? "#ef4444"
                      : "#f59e0b";

                return (
                  <div
                    key={key}
                    className="relative flex max-w-24 flex-1 flex-col items-center gap-2"
                    onMouseEnter={() => setHoveredPillar(key)}
                    onMouseLeave={() => setHoveredPillar(null)}
                  >
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.96 }}
                          className="absolute -top-26 left-1/2 z-20 min-w-36 -translate-x-1/2 rounded-[20px] border border-ink-100 bg-white px-3 py-3 text-ink-700 shadow-xl"
                        >
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
                            {d.label}
                          </div>
                          <div className="mt-1 text-lg font-black">
                            {d.value}
                            <span className="ml-1 text-xs font-normal text-ink-400">
                              {d.unit}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-ink-400">
                            AKG: {akgMin[key]}-{akgMax[key]} {d.unit}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div
                      className="relative flex w-full flex-col items-center"
                      style={{ height: 176 }}
                    >
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-[10px] border border-dashed"
                        style={{
                          height: maxBarH,
                          width: "86%",
                          maxWidth: 54,
                          backgroundColor: "rgba(22, 163, 74, 0.08)",
                          borderColor: "rgba(22, 163, 74, 0.22)",
                        }}
                      />
                      <div
                        className="absolute left-1/2 -translate-x-1/2 rounded-full"
                        style={{
                          bottom: minBarH,
                          width: "96%",
                          maxWidth: 58,
                          height: 2,
                          backgroundColor: "rgba(239, 68, 68, 0.35)",
                        }}
                      />
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: barH }}
                        transition={{
                          duration: 0.6,
                          delay: 0.1,
                          ease: "easeOut",
                        }}
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-[12px]"
                        style={{
                          width: "60%",
                          maxWidth: 42,
                          backgroundColor: color,
                          boxShadow: isHovered
                            ? `0 0 18px ${color}40`
                            : "0 10px 20px rgba(36,49,39,0.08)",
                        }}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="text-center text-[10px] font-medium leading-tight text-ink-500">
                        {d.label}
                      </span>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="card rounded-[30px] p-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-ink-700">AI Insights</h4>
                  <p className="text-xs text-ink-400">
                    {analysis.standar_referensi}
                  </p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-7 text-ink-500">
                {analysis.pesan}
              </p>
              <div className="space-y-3">
                {analysis.rekomendasi.slice(0, 3).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {rec.severity === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <p className="text-sm leading-6 text-ink-500">
                      {rec.pesan}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="card rounded-[30px] p-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-ink-700">
                    Optimization Suggestions
                  </h4>
                  <p className="text-xs text-ink-400">
                    Terapkan saran langsung ke data nutrisi menu.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {analysis.rekomendasi
                  .filter((r) => r.severity !== "success")
                  .slice(0, 3)
                  .map((rec, i) => {
                    const originalIdx = analysis.rekomendasi.indexOf(rec);
                    return (
                      <div
                        key={i}
                        className="rounded-[22px] border border-amber-100 bg-amber-50/60 p-4"
                      >
                        <p className="text-sm font-semibold text-ink-700">
                          {rec.nutrient
                            ? `Optimalkan ${rec.nutrient}`
                            : "Perbaikan Umum"}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-ink-400">
                          {rec.detail || rec.pesan}
                        </p>
                        <button
                          onClick={() => handleApplySuggestion(originalIdx)}
                          disabled={applyingIdx !== null}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3 py-1.5 text-xs font-bold text-forest-800 transition hover:bg-forest-50 disabled:opacity-50"
                        >
                          {applyingIdx === originalIdx ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Menerapkan...
                            </>
                          ) : (
                            <>
                              <Zap className="h-3 w-3" />
                              Apply Suggestion
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}

                {analysis.rekomendasi.filter((r) => r.severity !== "success")
                  .length === 0 && (
                  <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-5 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-700">
                      Semua nutrisi optimal.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : menus.length === 0 && !loading ? (
        <div className="card rounded-[30px] p-16 text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-ink-200" />
          <h3 className="mb-2 text-lg font-bold text-ink-600">
            Belum Ada Menu
          </h3>
          <p className="text-sm text-ink-400">
            Buat menu di Recipe Builder untuk memulai analisis AI.
          </p>
        </div>
      ) : !loading && !analysis ? (
        <div className="card rounded-[30px] p-14 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-forest-50 text-forest-800">
            <Brain className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-ink-700">
            Siap Menganalisis
          </h3>
          <p className="mx-auto max-w-md text-sm leading-7 text-ink-400">
            Pilih menu dan kelompok target MBG di atas, lalu klik "Mulai
            Analisis" untuk mendapatkan insight dari AI.
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
