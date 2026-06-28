import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import type { AIAnalysisResult } from "../types";
import { getCachedAnalysis, setCachedAnalysis } from "../utils/menuMeta";
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

interface AIAnalysisPanelProps {
  menuId: number;
  menuNama: string;
  menuType?: "makanan" | "minuman";
  onAnalysisSaved?: (menuId: number) => void;
}

export default function AIAnalysisPanel({
  menuId,
  menuNama,
  menuType,
  onAnalysisSaved,
}: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);

  const runAnalysis = async (force = false) => {
    if (!force) {
      const cached = getCachedAnalysis(menuId);
      if (cached) {
        setAnalysis(cached);
        setHasAnalyzed(true);
        setIsFromCache(true);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/${menuId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuType }),
      });
      const data = await readJsonResponse<AIAnalysisResult>(
        res,
        "Gagal menganalisis",
      );
      setAnalysis(data);
      setHasAnalyzed(true);
      setIsFromCache(false);
      setCachedAnalysis(menuId, data as AIAnalysisResult);
      onAnalysisSaved?.(menuId);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan tidak diketahui",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getCachedAnalysis(menuId);
    setAnalysis(cached);
    setError(null);
    setHasAnalyzed(Boolean(cached));
    setIsFromCache(Boolean(cached));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  const engine = (analysis?.ai_engine ?? "").toLowerCase();
  const isGemini = engine.includes("gemini");
  const isOpenAI = engine.includes("gpt") || engine.includes("openai");
  const isDeepSeek = engine.includes("deepseek");
  const engineLabel = isOpenAI
    ? "OpenAI"
    : isGemini
      ? "Gemini AI"
      : isDeepSeek
        ? "DeepSeek AI"
        : "Rule Based";

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const getScoreStroke = (score: number) => {
    if (score >= 75) return "#166534";
    if (score >= 50) return "#34d399";
    return "#dff6e8";
  };

  const getScoreText = (score: number) => {
    if (score >= 75) return "text-emerald-800";
    if (score >= 50) return "text-emerald-700";
    return "text-emerald-600";
  };

  const getScoreFill = (score: number) => {
    if (score >= 75) return "bg-emerald-800";
    if (score >= 50) return "bg-emerald-400";
    return "bg-emerald-100";
  };

  const getStatusChip = (_status: string) => {
    // Use green-graded chips for semantic consistency
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === "success") {
      return (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      );
    }
    if (severity === "warning") {
      return (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
      );
    }
    return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />;
  };

  const getSeverityCard = (_severity: string) => {
    return "border-emerald-100 bg-emerald-50/70";
  };

  if (loading) {
    return (
      <div className="border-t border-ink-100 bg-[linear-gradient(180deg,#fbfcfb_0%,#f4f7f4_100%)] p-8">
        <div className="surface-muted flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest-50 text-forest-800">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-700">
              Memproses analisis gizi untuk {menuNama}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              Sistem sedang mengambil insight nutrisi terbaru.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-ink-100 bg-[linear-gradient(180deg,#fbfcfb_0%,#f4f7f4_100%)] p-6">
        <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800">
                Gagal menganalisis menu
              </p>
              <p className="mt-1 text-xs leading-6 text-emerald-700">{error}</p>
              <button
                onClick={() => runAnalysis(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <RefreshCw className="h-3 w-3" />
                Coba lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis || !hasAnalyzed) {
    return (
      <div className="border-t border-ink-100 bg-[linear-gradient(180deg,#fcfdfc_0%,#f5f8f5_100%)] p-6">
        <div className="surface-muted flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-forest-50 text-forest-800">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink-700">
                Analisis Gizi AI
              </p>
              <p className="mt-1 text-xs leading-6 text-ink-400">
                Belum ada analisis untuk {menuNama}.
              </p>
            </div>
          </div>
          <button
            onClick={() => runAnalysis()}
            className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"
          >
            <Sparkles className="h-4 w-4" />
            Jalankan Analisis
          </button>
        </div>
      </div>
    );
  }

  const circumference = 2 * Math.PI * 42;
  const scoreDash = `${(analysis.skor_gizi / 100) * circumference} ${circumference}`;

  return (
    <div className="border-t border-ink-100 bg-[linear-gradient(180deg,#fcfdfc_0%,#f5f8f5_100%)]">
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-forest-50 text-forest-800">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-ink-700">
                  Analisis Gizi AI
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                    isGemini
                      ? "bg-forest-100 text-forest-800"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isGemini ? (
                    <Sparkles className="h-3 w-3" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  {engineLabel}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-ink-400">
                {analysis.pesan}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-400">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(analysis.analyzed_at)}
              </p>
              {isFromCache && (
                <p className="mt-2 text-[11px] font-medium text-forest-700">
                  Menampilkan hasil analisis tersimpan.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => runAnalysis(true)}
            className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Analisis ulang
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <div className="surface-muted flex flex-col items-center justify-center rounded-[28px] p-6 text-center">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#e4ebe3"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={getScoreStroke(analysis.skor_gizi)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={scoreDash}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-4xl font-black ${getScoreText(analysis.skor_gizi)}`}
                >
                  {analysis.skor_gizi}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                  score
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-ink-700">
              {analysis.status}
            </p>
            <p className="mt-1 text-xs text-ink-400">Skor total per porsi</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Object.entries(analysis.detail_analisis).map(([key, data]) => (
              <div
                key={key}
                className="rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                      {data.label}
                    </p>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getStatusChip(data.status)}`}
                    >
                      {data.status}
                    </span>
                    <p className="mt-2 text-2xl font-bold text-ink-700">
                      {data.value}
                      <span className="ml-1 text-xs font-medium text-ink-400">
                        {data.unit}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="progress-bar">
                  <div
                    className={`progress-fill ${getScoreFill(data.score)}`}
                    style={{ width: `${Math.min(data.score, 100)}%` }}
                  />
                </div>

                <p className="mt-2 text-[11px] leading-5 text-ink-400">
                  Standar {data.min}-{data.max} {data.unit}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-700">
                  Ringkasan Insight
                </p>
                <p className="text-xs text-ink-400">
                  {analysis.standar_referensi}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {analysis.rekomendasi.map((rec, idx) => (
                <div
                  key={`${rec.jenis}-${idx}`}
                  className={`rounded-[22px] border p-4 ${getSeverityCard(rec.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(rec.severity)}
                    <div className="min-w-0">
                      {rec.nutrient && (
                        <span className="table-chip mb-2 bg-white/80 text-ink-500">
                          {rec.nutrient}
                        </span>
                      )}
                      <p className="text-sm leading-6 text-ink-700">
                        {rec.pesan}
                      </p>
                      {rec.detail && (
                        <p className="mt-1 text-xs leading-6 text-ink-400">
                          {rec.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-gradient-to-br from-forest-950 via-forest-900 to-forest-800 p-5 text-white shadow-[0_24px_52px_rgba(23,59,35,0.22)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
              Executive Summary
            </p>
            <h4 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-white">
              {analysis.status}
            </h4>
            <p className="mt-3 text-sm leading-7 text-white/78">
              Panel ini menampilkan evaluasi gizi otomatis untuk membantu tim
              meninjau apakah komposisi menu sudah mendekati standar target.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/8 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                  Engine
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {engineLabel}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/8 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                  Severity
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {analysis.rekomendasi.length} rekomendasi
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
