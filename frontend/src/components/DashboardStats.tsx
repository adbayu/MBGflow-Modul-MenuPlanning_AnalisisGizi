import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Brain,
  Gauge,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MenuStats } from "../types";
import { MENU_API_URL } from "../config/api";

const API = MENU_API_URL;

interface DashboardStatsProps {
  onNavigateToList: () => void;
}

const AI_ENGINE = {
  name: "Google Gemini 1.5 Flash",
  model: "gemini-1.5-flash",
  provider: "Google AI",
  fallback: "Rule-Based (AKG Kemenkes RI)",
};

interface WidgetItem {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  tone: "emerald" | "blue" | "amber" | "rose" | "violet" | "cyan";
}

const toneStyles: Record<
  WidgetItem["tone"],
  { bg: string; icon: string; chip: string; watermark: string }
> = {
  emerald: {
    bg: "bg-emerald-50 border-emerald-200",
    icon: "text-emerald-600",
    chip: "bg-emerald-600",
    watermark: "text-emerald-200",
  },
  blue: {
    bg: "bg-blue-50 border-blue-200",
    icon: "text-blue-600",
    chip: "bg-blue-600",
    watermark: "text-blue-200",
  },
  amber: {
    bg: "bg-amber-50 border-amber-200",
    icon: "text-amber-600",
    chip: "bg-amber-600",
    watermark: "text-amber-200",
  },
  rose: {
    bg: "bg-rose-50 border-rose-200",
    icon: "text-rose-600",
    chip: "bg-rose-600",
    watermark: "text-rose-200",
  },
  violet: {
    bg: "bg-violet-50 border-violet-200",
    icon: "text-violet-600",
    chip: "bg-violet-600",
    watermark: "text-violet-200",
  },
  cyan: {
    bg: "bg-cyan-50 border-cyan-200",
    icon: "text-cyan-600",
    chip: "bg-cyan-600",
    watermark: "text-cyan-200",
  },
};

function getHealthScore(stats: MenuStats): number {
  const kalori = Number(stats.avg_nutrition?.avg_kalori || 0);
  const protein = Number(stats.avg_nutrition?.avg_protein || 0);
  const lemak = Number(stats.avg_nutrition?.avg_lemak || 0);
  const karbo = Number(stats.avg_nutrition?.avg_karbohidrat || 0);

  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const kaloriScore = clamp((kalori / 550) * 100);
  const proteinScore = clamp((protein / 25) * 100);
  const lemakScore = clamp((lemak / 18) * 100);
  const karboScore = clamp((karbo / 75) * 100);

  return Math.round((kaloriScore + proteinScore + lemakScore + karboScore) / 4);
}

export default function DashboardStats({
  onNavigateToList,
}: DashboardStatsProps) {
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/stats/summary`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const widgets = useMemo<WidgetItem[]>(() => {
    if (!stats) return [];

    const totalMenus = Number(stats.total_menus || 0);
    const activeMenus = Number(stats.active_menus || 0);
    const activeRatio =
      totalMenus > 0 ? Math.round((activeMenus / totalMenus) * 100) : 0;
    const healthScore = getHealthScore(stats);

    return [
      {
        title: "Total Menu",
        value: String(totalMenus),
        subtitle: "Seluruh menu yang tercatat",
        icon: UtensilsCrossed,
        tone: "emerald",
      },
      {
        title: "Menu Aktif",
        value: String(activeMenus),
        subtitle: "Menu siap produksi hari ini",
        icon: Activity,
        tone: "blue",
      },
      {
        title: "Rasio Menu Aktif",
        value: `${activeRatio}%`,
        subtitle: "Perbandingan menu aktif vs total",
        icon: TrendingUp,
        tone: "amber",
      },
      {
        title: "Skor Keseimbangan Gizi",
        value: `${healthScore}/100`,
        subtitle: "Indikator cepat kualitas rata-rata",
        icon: Gauge,
        tone: "rose",
      },
      {
        title: "Rata-rata Kalori",
        value: `${Math.round(stats.avg_nutrition?.avg_kalori || 0)} kkal`,
        subtitle: "Energi rata-rata per menu",
        icon: Zap,
        tone: "violet",
      },
      {
        title: "Rata-rata Protein",
        value: `${Math.round(stats.avg_nutrition?.avg_protein || 0)} g`,
        subtitle: "Dukungan kebutuhan pertumbuhan",
        icon: Sparkles,
        tone: "cyan",
      },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-16 w-16 text-slate-300" />
        <p className="text-slate-500">
          Gagal memuat data. Pastikan backend aktif di port 3002.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {widgets.map((item) => {
          const style = toneStyles[item.tone];
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${style.bg}`}
            >
              {/* Gambar transparan di belakang widget */}
              <Icon
                className={`pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 ${style.watermark} opacity-35`}
              />

              <div className="relative z-10">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {item.title}
                    </p>
                    <p className="mt-1 text-3xl font-black text-slate-900">
                      {item.value}
                    </p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${style.chip}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="max-w-[85%] text-xs font-medium text-slate-600">
                  {item.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-slate-800">
            Ringkasan Nutrisi Rata-rata
          </h3>
          <div className="space-y-4">
            {[
              {
                label: "Kalori",
                value: Number(stats.avg_nutrition?.avg_kalori || 0),
                target: 550,
                unit: "kkal",
              },
              {
                label: "Protein",
                value: Number(stats.avg_nutrition?.avg_protein || 0),
                target: 25,
                unit: "g",
              },
              {
                label: "Lemak",
                value: Number(stats.avg_nutrition?.avg_lemak || 0),
                target: 18,
                unit: "g",
              },
              {
                label: "Karbohidrat",
                value: Number(stats.avg_nutrition?.avg_karbohidrat || 0),
                target: 75,
                unit: "g",
              },
            ].map((row) => {
              const pct = Math.max(
                0,
                Math.min(100, Math.round((row.value / row.target) * 100)),
              );
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      {row.label}
                    </span>
                    <span className="text-slate-500">
                      {Math.round(row.value)} {row.unit}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-linear-to-br from-violet-50 to-indigo-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 p-2.5">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                AI Insight Engine
              </h3>
              <p className="text-xs text-slate-500">
                Mesin rekomendasi untuk analisis menu
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-white/70 px-3 py-2">
              <span className="font-medium">Model</span>
              <span className="font-bold text-violet-700">
                {AI_ENGINE.model}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-white/70 px-3 py-2">
              <span className="font-medium">Provider</span>
              <span className="font-bold text-violet-700">
                {AI_ENGINE.provider}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-white/70 px-3 py-2">
              <span className="font-medium">Fallback</span>
              <span className="font-bold text-violet-700">Active</span>
            </div>
          </div>

          <button
            onClick={onNavigateToList}
            className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Buka Katalog Menu
          </button>

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-violet-600" />
            Sistem tetap memberi rekomendasi walau API AI bermasalah.
          </div>
        </div>
      </div>
    </div>
  );
}
