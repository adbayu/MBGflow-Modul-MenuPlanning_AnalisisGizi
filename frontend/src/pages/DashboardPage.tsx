import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FlaskConical,
  Gauge,
  HeartPulse,
  Info,
  Leaf,
  ListFilter,
  Loader2,
  Milk,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
  UtensilsCrossed,
  UserRound,
  X,
} from "lucide-react";
import {
  CalorieIcon,
  CarboIcon,
  FatIcon,
  NutrientAssetIcon,
  ProteinIcon,
} from "../components/icons/NutrientIcons";
import pregnantImage from "../assets/images/MBG-Posyandu-akuratnews.id_.jpeg";
import studentsImage from "../assets/images/Sekolah_Dasar.jpeg";
import type {
  AIAnalysisResult,
  ManualMacronutrient,
  Menu,
  MenuStats,
  PageView,
} from "../types";
import {
  getPorsiLabel,
  inferMenuPorsi,
  inferMenuType,
  loadMenuMetaMap,
  sanitizeMenuName,
  saveMenuMetaMap,
  type MenuMetaEntry,
  type MenuPorsi,
  type MenuType,
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";
const HOLIDAY_API = "https://libur.deno.dev/api";
const WEEKLY_PLAN_STORAGE_KEY = "mbg_weekly_plan_v1";
const WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY = "mbg_weekly_plan_by_location_v1";
const SAVED_WEEKLY_LOCATION_STORAGE_KEY = "mbg_saved_weekly_location_v1";
const WEEKLY_PERIOD_STORAGE_KEY = "mbg_weekly_period_anchor_v1";
const PLATE_MENU_KEY = "mbg_plate_menu_ids_v1";

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

type Kelompok = "siswa" | "balita" | "ibu_hamil" | "ibu_menyusui" | "lansia";
const STANDAR: Record<
  Kelompok,
  {
    label: string;
    kalori: number;
    protein: number;
    karbo: number;
    lemak: number;
  }
> = {
  siswa: { label: "Siswa", kalori: 600, protein: 25, karbo: 80, lemak: 18 },
  balita: { label: "Balita", kalori: 450, protein: 20, karbo: 65, lemak: 15 },
  ibu_hamil: {
    label: "Ibu Hamil",
    kalori: 750,
    protein: 30,
    karbo: 90,
    lemak: 22,
  },
  ibu_menyusui: {
    label: "Ibu Menyusui",
    kalori: 800,
    protein: 32,
    karbo: 95,
    lemak: 24,
  },
  lansia: {
    label: "Lansia",
    kalori: 520,
    protein: 24,
    karbo: 70,
    lemak: 16,
  },
};

const AKG_MICRO_TARGETS: Record<
  Kelompok,
  Record<
    string,
    { label: string; target: number; unit: string; limitOnly?: boolean }
  >
> = {
  siswa: {
    serat: { label: "Serat", target: 8, unit: "g" },
    gula: { label: "Gula", target: 12, unit: "g", limitOnly: true },
    "vitamin a": { label: "Vitamin A", target: 180, unit: "mcg" },
    "vitamin c": { label: "Vitamin C", target: 18, unit: "mg" },
    "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg" },
    kalsium: { label: "Kalsium", target: 300, unit: "mg" },
    "zat besi": { label: "Zat Besi", target: 3, unit: "mg" },
    zinc: { label: "Zinc", target: 2.5, unit: "mg" },
    folat: { label: "Folat", target: 120, unit: "mcg" },
    natrium: { label: "Natrium", target: 450, unit: "mg", limitOnly: true },
    kalium: { label: "Kalium", target: 900, unit: "mg" },
    "omega 3": { label: "Omega-3", target: 0.3, unit: "g" },
  },
  balita: {
    serat: { label: "Serat", target: 5, unit: "g" },
    gula: { label: "Gula", target: 8, unit: "g", limitOnly: true },
    "vitamin a": { label: "Vitamin A", target: 120, unit: "mcg" },
    "vitamin c": { label: "Vitamin C", target: 12, unit: "mg" },
    "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg" },
    kalsium: { label: "Kalsium", target: 195, unit: "mg" },
    "zat besi": { label: "Zat Besi", target: 2.1, unit: "mg" },
    zinc: { label: "Zinc", target: 1.5, unit: "mg" },
    folat: { label: "Folat", target: 48, unit: "mcg" },
    natrium: { label: "Natrium", target: 240, unit: "mg", limitOnly: true },
    kalium: { label: "Kalium", target: 780, unit: "mg" },
    "omega 3": { label: "Omega-3", target: 0.21, unit: "g" },
  },
  ibu_hamil: {
    serat: { label: "Serat", target: 10, unit: "g" },
    gula: { label: "Gula", target: 15, unit: "g", limitOnly: true },
    "vitamin a": { label: "Vitamin A", target: 255, unit: "mcg" },
    "vitamin c": { label: "Vitamin C", target: 25.5, unit: "mg" },
    "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg" },
    kalsium: { label: "Kalsium", target: 360, unit: "mg" },
    "zat besi": { label: "Zat Besi", target: 8.1, unit: "mg" },
    zinc: { label: "Zinc", target: 3.6, unit: "mg" },
    folat: { label: "Folat", target: 180, unit: "mcg" },
    natrium: { label: "Natrium", target: 450, unit: "mg", limitOnly: true },
    kalium: { label: "Kalium", target: 1410, unit: "mg" },
    "omega 3": { label: "Omega-3", target: 0.42, unit: "g" },
  },
  ibu_menyusui: {
    serat: { label: "Serat", target: 11, unit: "g" },
    gula: { label: "Gula", target: 15, unit: "g", limitOnly: true },
    "vitamin a": { label: "Vitamin A", target: 255, unit: "mcg" },
    "vitamin c": { label: "Vitamin C", target: 30, unit: "mg" },
    "vitamin d": { label: "Vitamin D", target: 4.5, unit: "mcg" },
    kalsium: { label: "Kalsium", target: 360, unit: "mg" },
    "zat besi": { label: "Zat Besi", target: 5.4, unit: "mg" },
    zinc: { label: "Zinc", target: 3.9, unit: "mg" },
    folat: { label: "Folat", target: 150, unit: "mcg" },
    natrium: { label: "Natrium", target: 450, unit: "mg", limitOnly: true },
    kalium: { label: "Kalium", target: 1530, unit: "mg" },
    "omega 3": { label: "Omega-3", target: 0.42, unit: "g" },
  },
  lansia: {
    serat: { label: "Serat", target: 9, unit: "g" },
    gula: { label: "Gula", target: 10, unit: "g", limitOnly: true },
    "vitamin a": { label: "Vitamin A", target: 180, unit: "mcg" },
    "vitamin c": { label: "Vitamin C", target: 22.5, unit: "mg" },
    "vitamin d": { label: "Vitamin D", target: 6, unit: "mcg" },
    kalsium: { label: "Kalsium", target: 360, unit: "mg" },
    "zat besi": { label: "Zat Besi", target: 2.4, unit: "mg" },
    zinc: { label: "Zinc", target: 3.3, unit: "mg" },
    folat: { label: "Folat", target: 120, unit: "mcg" },
    natrium: { label: "Natrium", target: 360, unit: "mg", limitOnly: true },
    kalium: { label: "Kalium", target: 1410, unit: "mg" },
    "omega 3": { label: "Omega-3", target: 0.33, unit: "g" },
  },
};

const TARGET_TABS: Array<{ key: Kelompok; icon: typeof Users }> = [
  { key: "siswa", icon: Users },
  { key: "balita", icon: Baby },
  { key: "ibu_hamil", icon: HeartPulse },
  { key: "ibu_menyusui", icon: Milk },
  { key: "lansia", icon: UserRound },
];

interface DayPlan {
  makananIds: number[];
  minumanIds: number[];
}

type WeeklyPlan = Record<string, DayPlan>;
type WeeklyPlanByLocation = Record<string, WeeklyPlan>;
type SavedScheduleMap = Record<string, string>;
type HolidayMap = Record<string, string>;
type MenuMetaMap = Record<number, MenuMetaEntry>;
type SchedulePeriodStatus = "complete" | "partial" | "empty";

interface WeekDay {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
}

const MANUAL_NUTRIENT_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#14b8a6",
  "#eab308",
  "#06b6d4",
  "#f43f5e",
];

function normalizeNutrientName(name: string) {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    "vit a": "vitamin a",
    vitamina: "vitamin a",
    "vit c": "vitamin c",
    vitaminc: "vitamin c",
    "vit d": "vitamin d",
    vitamind: "vitamin d",
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
  return aliases[key] || key;
}

interface WeeklyPeriodOption {
  index: number;
  title: string;
  startDate: Date;
  endDate: Date;
  startKey: string;
  rangeLabel: string;
  fullRangeLabel: string;
  dayKeys: string[];
  days: WeekDay[];
}

interface WeeklyPeriodSummary extends WeeklyPeriodOption {
  status: SchedulePeriodStatus;
  statusLabel: string;
  filledDayCount: number;
  menuCount: number;
  uniqueMenuCount: number;
  akgCompliance: number;
  foodWasteRisk: string;
  missingLabels: string[];
  completionPercent: number;
}

const OPERATIONAL_DAY_LABELS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function convertNutrientUnit(value: number, fromUnit: string, toUnit: string) {
  const from = (fromUnit || toUnit).toLowerCase().replace("ug", "mcg");
  const to = (toUnit || fromUnit).toLowerCase().replace("ug", "mcg");
  if (!from || !to || from === to) return value;
  if (from === "g" && to === "mg") return value * 1000;
  if (from === "mg" && to === "g") return value / 1000;
  if (from === "mg" && to === "mcg") return value * 1000;
  if (from === "mcg" && to === "mg") return value / 1000;
  if (from === "g" && to === "mcg") return value * 1000000;
  if (from === "mcg" && to === "g") return value / 1000000;
  return value;
}

function createEmptyDayPlan(): DayPlan {
  return { makananIds: [], minumanIds: [] };
}

function normalizeDayPlan(raw: unknown): DayPlan {
  if (Array.isArray(raw)) {
    // Backward compatibility: versi lama menyimpan array tunggal
    return {
      makananIds: raw.filter((id) => typeof id === "number"),
      minumanIds: [],
    };
  }

  if (!raw || typeof raw !== "object") {
    return createEmptyDayPlan();
  }

  const day = raw as Partial<DayPlan>;
  return {
    makananIds: Array.isArray(day.makananIds)
      ? day.makananIds.filter((id) => typeof id === "number")
      : [],
    minumanIds: Array.isArray(day.minumanIds)
      ? day.minumanIds.filter((id) => typeof id === "number")
      : [],
  };
}

function getDayMenuIds(day: DayPlan) {
  return Array.from(new Set([...day.makananIds, ...day.minumanIds]));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekDays(now = new Date()): WeekDay[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const jsDay = today.getDay();
  const daysFromMonday = jsDay === 0 ? 6 : jsDay - 1;

  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return OPERATIONAL_DAY_LABELS.map((label, idx) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + idx);

    return {
      dateKey: toDateKey(current),
      dayLabel: label,
      dateLabel: current.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      isToday: toDateKey(current) === toDateKey(today),
    };
  });
}

function resolveMenuImageUrl(gambarUrl: string | null | undefined) {
  if (!gambarUrl) return null;
  if (gambarUrl.startsWith("http://") || gambarUrl.startsWith("https://")) {
    return gambarUrl;
  }
  return `${API_ORIGIN}${gambarUrl}`;
}

function dateFromKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addCalendarMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getOperationalMonday(date: Date) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const jsDay = current.getDay();
  const daysFromMonday = jsDay === 0 ? 6 : jsDay - 1;
  current.setDate(current.getDate() - daysFromMonday);
  return current;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLong(date: Date) {
  return date.toLocaleDateString("id-ID", { month: "long" });
}

function formatPeriodRange(start: Date, end: Date, includeYear = false) {
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString("id-ID", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const endLabel = end.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: includeYear ? "numeric" : undefined,
  });
  return `${startLabel} - ${endLabel}`;
}

function buildOperationalWeek(
  startDate: Date,
  index: number,
): WeeklyPeriodOption {
  const start = new Date(startDate);
  const end = addCalendarDays(start, 5);
  const todayKey = toDateKey(new Date());
  const days = OPERATIONAL_DAY_LABELS.map((dayLabel, idx) => {
    const date = addCalendarDays(start, idx);
    const dateKey = toDateKey(date);
    return {
      dateKey,
      dayLabel,
      dateLabel: date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      isToday: dateKey === todayKey,
    };
  });

  return {
    index,
    title: `Minggu ${index}`,
    startDate: start,
    endDate: end,
    startKey: toDateKey(start),
    rangeLabel: formatPeriodRange(start, end),
    fullRangeLabel: formatPeriodRange(start, end, true),
    dayKeys: days.map((day) => day.dateKey),
    days,
  };
}

function createMonthlyOperationalPeriods(anchor: Date) {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const firstMonday = getOperationalMonday(firstOfMonth);
  return Array.from({ length: 6 }, (_, idx) =>
    buildOperationalWeek(addCalendarDays(firstMonday, idx * 7), idx + 1),
  );
}

function getOperationalMonthLabel(anchor: Date) {
  const periods = createMonthlyOperationalPeriods(anchor);
  const start = periods[0].startDate;
  const end = periods[periods.length - 1].endDate;
  const yearLabel =
    start.getFullYear() === end.getFullYear()
      ? `${end.getFullYear()}`
      : `${start.getFullYear()} - ${end.getFullYear()}`;
  return `${formatMonthLong(start)} - ${formatMonthLong(end)} ${yearLabel}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function getPorsiBadgeClass(porsi: MenuPorsi) {
  return porsi === "porsi_besar"
    ? "bg-orange-100 text-orange-700"
    : "bg-sky-100 text-sky-700";
}

function getTypeBadgeClass(type: MenuType) {
  return type === "minuman"
    ? "bg-cyan-100 text-cyan-700"
    : "bg-emerald-100 text-emerald-700";
}

function getKelompokBadgeClass(kategori: Menu["kategori"]) {
  if (kategori === "Siswa") return "bg-blue-100 text-blue-700";
  if (kategori === "Balita") return "bg-pink-100 text-pink-700";
  return "bg-amber-100 text-amber-700";
}

function getAkgStatus(percent: number) {
  // New green-based semantic scale per design spec
  if (percent < 70) {
    return {
      label: "Sangat Kurang",
      badgeClass: "border border-emerald-50 bg-emerald-50 text-emerald-700/50",
      textClass: "text-emerald-600/60",
      ringColor: "#dff6e8",
      barColor: "#dff6e8",
      hint: "Jauh di bawah target harian.",
    };
  }

  if (percent < 90) {
    return {
      label: "Cukup",
      badgeClass: "border border-emerald-100 bg-emerald-100 text-emerald-700",
      textClass: "text-emerald-700",
      ringColor: "#bbf7d0",
      barColor: "#86efac",
      hint: "Cukup mendekati target.",
    };
  }

  if (percent <= 110) {
    return {
      label: "Optimal",
      badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-800",
      textClass: "text-emerald-800",
      ringColor: "#34d399",
      barColor: "#10b981",
      hint: "Dalam kisaran optimal.",
    };
  }

  if (percent <= 120) {
    return {
      label: "Mulai Berlebih",
      badgeClass: "border border-emerald-700 bg-emerald-200 text-emerald-900",
      textClass: "text-emerald-900",
      ringColor: "#14532d",
      barColor: "#166534",
      hint: "Mulai melebihi rekomendasi.",
    };
  }

  return {
    label: "Terlalu Berlebih",
    badgeClass: "border border-emerald-900 bg-emerald-800 text-white",
    textClass: "text-emerald-950",
    ringColor: "#064e3b",
    barColor: "#064e3b",
    hint: "Signifikan melebihi target.",
  };
}

function MiniDonut({
  protein,
  karbo,
  lemak,
  size = 40,
}: {
  protein: number;
  karbo: number;
  lemak: number;
  size?: number;
}) {
  const total = protein + karbo + lemak;

  if (total === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-full border border-gray-200 bg-gray-50"
      >
        <span className="text-[8px] text-gray-300">N/A</span>
      </div>
    );
  }

  const slices = [
    { value: karbo, color: "#8b5cf6", label: "Karbo" },
    { value: protein, color: "#10b981", label: "Protein" },
    { value: lemak, color: "#f59e0b", label: "Lemak" },
  ];

  let start = 0;

  return (
    <svg viewBox="0 0 42 42" width={size} height={size}>
      <circle cx="21" cy="21" r="12" fill="white" />
      {slices.map((s) => {
        const pct = (s.value / total) * 100;
        const node = (
          <circle
            key={s.label}
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke={s.color}
            strokeWidth="5"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset={-start}
          />
        );
        start += pct;
        return node;
      })}
    </svg>
  );
}

interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

function CompositionDonut({
  segments,
  centerValue,
  centerLabel,
  sizeClass = "h-52 w-52",
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  sizeClass?: string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={`relative mx-auto ${sizeClass}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e8eee8"
          strokeWidth="12"
        />
        {segments.map((segment) => {
          const length =
            total > 0 ? (segment.value / total) * circumference : 0;
          const node = (
            <circle
              key={segment.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeLinecap="round"
              strokeWidth="12"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return node;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black text-ink-700">{centerValue}</span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

interface DashboardPageProps {
  onNavigate: (p: PageView) => void;
  mode?: "full" | "weekly";
}

interface SummaryWidget {
  title: string;
  value: string | number;
  subtitle: string;
  insight: string;
  gradient: string;
  iconBg: string;
  icon: typeof UtensilsCrossed;
  watermarkColor: string;
}

interface DistributionLocation {
  id: string;
  type: "sekolah" | "posyandu";
  recipients: Array<{ label: string; target: string }>;
  image?: string;
  image_key?: string;
  name: string;
  target: string;
  schedule: string;
  note: string;
}

const DISTRIBUTION_LOCATION_IMAGES: Record<string, string> = {
  students: studentsImage,
  pregnant: pregnantImage,
};

const DEFAULT_DISTRIBUTION_LOCATIONS: DistributionLocation[] = [
  {
    id: "sdn-01-sukamaju",
    type: "sekolah",
    recipients: [{ label: "Siswa", target: "320 siswa" }],
    image: studentsImage,
    name: "SD Negeri 01 Sukamaju",
    target: "320 siswa",
    schedule: "Sesi pagi",
    note: "Prioritas menu aktif dan porsi siswa dengan variasi lauk cukup.",
  },
  {
    id: "smpn-03-sukamaju",
    type: "sekolah",
    recipients: [{ label: "Siswa", target: "410 siswa" }],
    image: studentsImage,
    name: "SMP Negeri 03 Sukamaju",
    target: "410 siswa",
    schedule: "Sesi siang",
    note: "Cek rotasi protein agar menu tidak terasa berulang.",
  },
  {
    id: "posyandu-melati-balita",
    type: "posyandu",
    recipients: [
      { label: "Balita", target: "85 balita" },
      { label: "Ibu Hamil", target: "47 ibu hamil" },
    ],
    image: pregnantImage,
    name: "Posyandu Melati",
    target: "132 penerima",
    schedule: "Sesi timbang & edukasi",
    note: "Balita memakai porsi kecil bertekstur lembut; ibu hamil diprioritaskan protein, folat, dan sayur hijau.",
  },
  {
    id: "posyandu-mawar",
    type: "posyandu",
    recipients: [
      { label: "Balita", target: "58 balita" },
      { label: "Ibu Hamil", target: "62 ibu hamil" },
    ],
    image: pregnantImage,
    name: "Posyandu Mawar",
    target: "120 penerima",
    schedule: "Sesi PMT & konseling",
    note: "Balita dijaga tekstur dan energi; ibu hamil difokuskan pada protein, zat besi, dan energi cukup.",
  },
];

const EMPTY_DISTRIBUTION_LOCATION: DistributionLocation = {
  id: "",
  type: "sekolah",
  recipients: [],
  image: studentsImage,
  name: "Belum ada lokasi yang ditetapkan",
  target: "0 penerima",
  schedule: "-",
  note: "Tambahkan lokasi distribusi di database agar jadwal dapat dipakai.",
};

function withDistributionImage(location: DistributionLocation) {
  return {
    ...location,
    image:
      location.image ||
      DISTRIBUTION_LOCATION_IMAGES[location.image_key || "students"] ||
      studentsImage,
  };
}

function getLocationRecipientLabel(location: DistributionLocation) {
  return location.recipients.map((recipient) => recipient.label).join(" & ");
}

function parseTargetCount(raw: string) {
  const match = String(raw || "").match(/\d+/g);
  if (!match) return 0;
  return Number(match.join("")) || 0;
}

function evaluateMenuAkgStatus(menu: Menu) {
  const targetMap: Record<
    Menu["kategori"],
    { kalori: number; protein: number; karbo: number; lemak: number }
  > = {
    Siswa: STANDAR.siswa,
    Balita: STANDAR.balita,
    "Ibu Hamil": STANDAR.ibu_hamil,
  };

  const target = targetMap[menu.kategori] || STANDAR.siswa;
  const kalori = Number(menu.kalori || 0);
  const protein = Number(menu.protein || 0);
  const karbo = Number(menu.karbohidrat || 0);
  const lemak = Number(menu.lemak || 0);

  if (kalori <= 0 && protein <= 0 && karbo <= 0 && lemak <= 0) {
    return false;
  }

  const inRange = (
    value: number,
    ref: number,
    minRatio = 0.85,
    maxRatio = 1.2,
  ) => value >= ref * minRatio && value <= ref * maxRatio;

  return (
    inRange(kalori, target.kalori) &&
    inRange(protein, target.protein) &&
    inRange(karbo, target.karbo) &&
    inRange(lemak, target.lemak)
  );
}

export default function DashboardPage({
  onNavigate,
  mode = "full",
}: DashboardPageProps) {
  const isWeeklyOnly = mode === "weekly";
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [kelompok, setKelompok] = useState<Kelompok>("siswa");
  const [search, setSearch] = useState("");
  const [plateMenuSearch, setPlateMenuSearch] = useState("");
  const [plateTargetFilter, setPlateTargetFilter] = useState<"all" | "target">(
    "all",
  );
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [plateMenuIds, setPlateMenuIds] = useState<number[]>(() => {
    const stored = localStorage.getItem(PLATE_MENU_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [distributionLocations, setDistributionLocations] = useState<
    DistributionLocation[]
  >([]);
  const [activeLocationId, setActiveLocationId] = useState("");
  const [weeklyPlanByLocation, setWeeklyPlanByLocation] =
    useState<WeeklyPlanByLocation>({});
  const [savedScheduleMap, setSavedScheduleMap] = useState<SavedScheduleMap>(
    {},
  );
  const [menuMetaMap, setMenuMetaMap] = useState<MenuMetaMap>({});
  const [draggingMenuId, setDraggingMenuId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [plateManualMacrosMap, setPlateManualMacrosMap] = useState<
    Record<number, ManualMacronutrient[]>
  >({});
  const [plateIngredientCountMap, setPlateIngredientCountMap] = useState<
    Record<number, number>
  >({});
  const [plateAiAnalysis, setPlateAiAnalysis] =
    useState<AIAnalysisResult | null>(null);
  const [plateAiLoading, setPlateAiLoading] = useState(false);
  const [plateAiError, setPlateAiError] = useState<string | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [showSaveScheduleConfirm, setShowSaveScheduleConfirm] = useState(false);
  const [showPlateMenuModal, setShowPlateMenuModal] = useState(false);
  const [showSchedulePeriodModal, setShowSchedulePeriodModal] = useState(false);
  const [periodSearch, setPeriodSearch] = useState("");
  const [periodStatusFilter, setPeriodStatusFilter] = useState<
    "all" | SchedulePeriodStatus
  >("all");
  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});
  const [weeklyStateLoaded, setWeeklyStateLoaded] = useState(false);
  const [weeklyPeriodAnchor, setWeeklyPeriodAnchor] = useState(() => {
    const stored = localStorage.getItem(WEEKLY_PERIOD_STORAGE_KEY);
    return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)
      ? stored
      : toDateKey(new Date());
  });

  const openDistributionModal = () => {
    setShowDistributionModal(true);
  };

  const activeLocation =
    distributionLocations.find(
      (location) => location.id === activeLocationId,
    ) || EMPTY_DISTRIBUTION_LOCATION;
  const hasActiveLocationSelection = Boolean(
    activeLocationId && activeLocation.id,
  );
  const weeklyPlan = weeklyPlanByLocation[activeLocationId] || {};
  const activeLocationRecipients = getLocationRecipientLabel(activeLocation);

  useEffect(() => {
    Promise.all([
      fetch(API).then((r) => readJsonResponse<Menu[]>(r, "Gagal memuat menu")),
      fetch(`${API}/stats/summary`).then((r) =>
        readJsonResponse<MenuStats>(r, "Gagal memuat statistik"),
      ),
    ])
      .then(([m, s]: [unknown, unknown]) => {
        const list = Array.isArray(m) ? (m as Menu[]) : [];
        setMenus(list);
        setStats(s as MenuStats);

        const currentMeta = loadMenuMetaMap();
        const nextMeta = { ...currentMeta };
        let changed = false;

        list.forEach((menu) => {
          if (!nextMeta[menu.id]) {
            nextMeta[menu.id] = {
              type: inferMenuType(menu),
              porsi: inferMenuPorsi(menu.kalori),
              updatedAt: new Date().toISOString(),
            };
            changed = true;
          }
        });

        if (changed) {
          saveMenuMetaMap(nextMeta);
        }
        setMenuMetaMap(nextMeta);

        if (list.length > 0) {
          setSelectedMenuId(list[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem(WEEKLY_PERIOD_STORAGE_KEY, weeklyPeriodAnchor);
  }, [weeklyPeriodAnchor]);

  useEffect(() => {
    let active = true;

    fetch(`${API}/distribution-locations`)
      .then((res) =>
        readJsonResponse<DistributionLocation[]>(
          res,
          "Gagal memuat lokasi distribusi",
        ),
      )
      .then((locations) => {
        if (!active || !Array.isArray(locations) || locations.length === 0) {
          return;
        }
        setDistributionLocations(locations.map(withDistributionImage));
      })
      .catch((error) => {
        console.error("Gagal memuat lokasi distribusi:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetch(HOLIDAY_API)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!active || !Array.isArray(data)) return;

        const next: HolidayMap = {};
        data.forEach((item) => {
          if (!item || typeof item !== "object") return;
          const holiday = item as { date?: unknown; name?: unknown };
          if (typeof holiday.date !== "string") return;
          next[holiday.date] =
            typeof holiday.name === "string" ? holiday.name : "Hari Libur";
        });
        setHolidayMap(next);
      })
      .catch((error) => {
        console.error("Gagal memuat tanggal merah:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadLocalWeeklyState = () => {
      const result: {
        plans: WeeklyPlanByLocation;
        savedScheduleMap: SavedScheduleMap;
      } = { plans: {}, savedScheduleMap: {} };

      const savedByLocation = localStorage.getItem(
        WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY,
      );
      const savedStatus = localStorage.getItem(
        SAVED_WEEKLY_LOCATION_STORAGE_KEY,
      );

      if (savedStatus) {
        const parsedStatus = JSON.parse(savedStatus);
        if (parsedStatus && typeof parsedStatus === "object") {
          result.savedScheduleMap = parsedStatus as SavedScheduleMap;
        }
      }

      if (savedByLocation) {
        const parsed = JSON.parse(savedByLocation) as Record<
          string,
          Record<string, unknown>
        >;
        if (parsed && typeof parsed === "object") {
          const normalizedByLocation: WeeklyPlanByLocation = {};
          Object.entries(parsed).forEach(([locationId, plan]) => {
            normalizedByLocation[locationId] = {};
            Object.entries(plan || {}).forEach(([dateKey, day]) => {
              normalizedByLocation[locationId][dateKey] = normalizeDayPlan(day);
            });
          });
          result.plans = normalizedByLocation;
          return result;
        }
      }

      const saved = localStorage.getItem(WEEKLY_PLAN_STORAGE_KEY);
      if (!saved) return result;

      const parsed = JSON.parse(saved) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const normalized: WeeklyPlan = {};
        Object.entries(parsed).forEach(([dateKey, day]) => {
          normalized[dateKey] = normalizeDayPlan(day);
        });
        result.plans = {
          [DEFAULT_DISTRIBUTION_LOCATIONS[0].id]: normalized,
        };
      }

      return result;
    };

    const applyWeeklyState = (data: {
      plans?: unknown;
      savedScheduleMap?: unknown;
    }) => {
      const normalizedByLocation: WeeklyPlanByLocation = {};

      if (data.plans && typeof data.plans === "object") {
        Object.entries(
          data.plans as Record<string, Record<string, unknown>>,
        ).forEach(([locationId, plan]) => {
          normalizedByLocation[locationId] = {};
          Object.entries(plan || {}).forEach(([dateKey, day]) => {
            normalizedByLocation[locationId][dateKey] = normalizeDayPlan(day);
          });
        });
      }

      setWeeklyPlanByLocation(normalizedByLocation);
      setSavedScheduleMap(
        data.savedScheduleMap && typeof data.savedScheduleMap === "object"
          ? (data.savedScheduleMap as SavedScheduleMap)
          : {},
      );
    };

    fetch(`${API}/weekly-plans`)
      .then((res) =>
        readJsonResponse<{
          plans: WeeklyPlanByLocation;
          savedScheduleMap: SavedScheduleMap;
        }>(res, "Gagal memuat jadwal mingguan"),
      )
      .then((data) => {
        applyWeeklyState(data);
      })
      .catch((error) => {
        console.error("Gagal memuat jadwal dari database:", error);
        try {
          applyWeeklyState(loadLocalWeeklyState());
        } catch (localError) {
          console.error("Gagal memuat jadwal lokal:", localError);
        }
      })
      .finally(() => {
        setWeeklyStateLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!weeklyStateLoaded) return;

    localStorage.setItem(
      WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY,
      JSON.stringify(weeklyPlanByLocation),
    );
    localStorage.setItem(
      SAVED_WEEKLY_LOCATION_STORAGE_KEY,
      JSON.stringify(savedScheduleMap),
    );

    const timeoutId = window.setTimeout(() => {
      fetch(`${API}/weekly-plans`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plans: weeklyPlanByLocation,
          savedScheduleMap,
        }),
      })
        .then((res) => readJsonResponse(res, "Gagal menyimpan jadwal mingguan"))
        .catch((error) => {
          console.error("Gagal menyimpan jadwal ke database:", error);
        });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [savedScheduleMap, weeklyPlanByLocation, weeklyStateLoaded]);

  const weekDays = useMemo(
    () => getCurrentWeekDays(dateFromKey(weeklyPeriodAnchor)),
    [weeklyPeriodAnchor],
  );
  const weekPeriod =
    weekDays.length > 0
      ? `${weekDays[0].dateLabel} - ${weekDays[weekDays.length - 1].dateLabel}`
      : "";
  const menuLookup = useMemo(
    () => new Map(menus.map((menu) => [menu.id, menu])),
    [menus],
  );

  const schedulePeriods = useMemo(() => {
    const target = STANDAR[kelompok];
    return createMonthlyOperationalPeriods(dateFromKey(weeklyPeriodAnchor)).map(
      (period): WeeklyPeriodSummary => {
        const dayMenuIds = period.dayKeys.map((dateKey) =>
          getDayMenuIds(normalizeDayPlan(weeklyPlan[dateKey])),
        );
        const filledDayCount = dayMenuIds.filter(
          (ids) => ids.length > 0,
        ).length;
        const allMenuIds = dayMenuIds.flat();
        const uniqueMenuIds = Array.from(new Set(allMenuIds));
        const periodMenus = uniqueMenuIds
          .map((id) => menuLookup.get(id))
          .filter((menu): menu is Menu => Boolean(menu));

        const totals = periodMenus.reduce(
          (acc, menu) => ({
            kalori: acc.kalori + Number(menu.kalori || 0),
            protein: acc.protein + Number(menu.protein || 0),
            karbo: acc.karbo + Number(menu.karbohidrat || 0),
            lemak: acc.lemak + Number(menu.lemak || 0),
          }),
          { kalori: 0, protein: 0, karbo: 0, lemak: 0 },
        );
        const avgByDay = Math.max(1, filledDayCount);
        const ratios = [
          totals.kalori / avgByDay / target.kalori,
          totals.protein / avgByDay / target.protein,
          totals.karbo / avgByDay / target.karbo,
          totals.lemak / avgByDay / target.lemak,
        ].filter((value) => Number.isFinite(value) && value > 0);
        const akgCompliance =
          ratios.length > 0
            ? Math.min(
                125,
                Math.round(
                  (ratios.reduce(
                    (sum, value) => sum + Math.min(value, 1.15),
                    0,
                  ) /
                    ratios.length) *
                    100,
                ),
              )
            : 0;
        const completionPercent = Math.round((filledDayCount / 6) * 100);
        const status: SchedulePeriodStatus =
          filledDayCount === 6
            ? "complete"
            : filledDayCount > 0
              ? "partial"
              : "empty";
        const statusLabel =
          status === "complete"
            ? "Jadwal Lengkap"
            : status === "partial"
              ? "Sebagian Terisi"
              : "Belum Ada Jadwal";
        const missingLabels = period.days
          .filter((_day, idx) => dayMenuIds[idx].length === 0)
          .map((day) => day.dayLabel);
        const foodWasteRisk =
          status === "empty"
            ? "Belum Terdeteksi"
            : status === "complete" && uniqueMenuIds.length >= 10
              ? "Rendah"
              : status === "partial"
                ? "Sedang"
                : "Terkendali";

        return {
          ...period,
          status,
          statusLabel,
          filledDayCount,
          menuCount: allMenuIds.length,
          uniqueMenuCount: uniqueMenuIds.length,
          akgCompliance,
          foodWasteRisk,
          missingLabels,
          completionPercent,
        };
      },
    );
  }, [kelompok, menuLookup, weeklyPeriodAnchor, weeklyPlan]);

  const activeSchedulePeriod =
    schedulePeriods.find((period) =>
      period.dayKeys.includes(weeklyPeriodAnchor),
    ) || schedulePeriods[0];

  const visibleSchedulePeriods = schedulePeriods.filter((period) => {
    const q = periodSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      period.title.toLowerCase().includes(q) ||
      period.rangeLabel.toLowerCase().includes(q) ||
      period.statusLabel.toLowerCase().includes(q);
    const matchesStatus =
      periodStatusFilter === "all" || period.status === periodStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const schedulePeriodMonthOptions = useMemo(() => {
    const current = dateFromKey(weeklyPeriodAnchor);
    return Array.from({ length: 7 }, (_, idx) => {
      const optionDate = addCalendarMonths(current, idx - 3);
      optionDate.setDate(1);
      const key = getMonthKey(optionDate);
      return {
        key,
        value: toDateKey(optionDate),
        label: getOperationalMonthLabel(optionDate),
      };
    });
  }, [weeklyPeriodAnchor]);

  const resolvedMenuPorsi = useMemo(() => {
    const result: Record<number, MenuPorsi> = {};
    menus.forEach((menu) => {
      result[menu.id] =
        menuMetaMap[menu.id]?.porsi || inferMenuPorsi(menu.kalori);
    });
    return result;
  }, [menus, menuMetaMap]);

  const resolvedMenuType = useMemo(() => {
    const result: Record<number, MenuType> = {};
    menus.forEach((menu) => {
      result[menu.id] = menuMetaMap[menu.id]?.type || inferMenuType(menu);
    });
    return result;
  }, [menus, menuMetaMap]);

  const totalScheduledCount = useMemo(
    () =>
      Object.values(weeklyPlan).reduce((acc, day) => {
        const normalized = normalizeDayPlan(day);
        return acc + getDayMenuIds(normalized).length;
      }, 0),
    [weeklyPlan],
  );

  const activeLocationSaved = Boolean(savedScheduleMap[activeLocationId]);

  const piringkuMenus = useMemo(
    () => menus.filter((m) => plateMenuIds.includes(m.id)),
    [menus, plateMenuIds],
  );

  const runPlateAnalysis = async () => {
    if (plateMenuIds.length === 0) {
      setPlateAiAnalysis(null);
      setPlateAiError(null);
      setPlateAiLoading(false);
      return;
    }

    setPlateAiLoading(true);
    setPlateAiError(null);

    try {
      const res = await fetch(`${API}/analyze-plate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuIds: plateMenuIds,
          target: STANDAR[kelompok].label,
          targetKey: kelompok,
        }),
      });
      const data = await readJsonResponse<AIAnalysisResult>(
        res,
        "Analisis AI gagal",
      );
      setPlateAiAnalysis(data as AIAnalysisResult);
    } catch (err: unknown) {
      setPlateAiError(
        err instanceof Error ? err.message : "Analisis AI gagal diproses",
      );
      setPlateAiAnalysis(null);
    } finally {
      setPlateAiLoading(false);
    }
  };

  useEffect(() => {
    setPlateAiAnalysis(null);
    setPlateAiError(null);
    setPlateAiLoading(false);
  }, [kelompok, plateMenuIds]);

  useEffect(() => {
    localStorage.setItem(PLATE_MENU_KEY, JSON.stringify(plateMenuIds));
  }, [plateMenuIds]);

  useEffect(() => {
    const missingIds = plateMenuIds.filter(
      (id) =>
        !plateManualMacrosMap[id] || plateIngredientCountMap[id] === undefined,
    );
    if (missingIds.length === 0) return;

    let active = true;

    Promise.all(
      missingIds.map((menuId) =>
        fetch(`${API}/${menuId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => ({
            menuId,
            manual: Array.isArray(data?.manual_macronutrients)
              ? (data.manual_macronutrients as ManualMacronutrient[])
              : [],
            ingredientsCount: Array.isArray(data?.ingredients)
              ? data.ingredients.length
              : 0,
          }))
          .catch(() => ({
            menuId,
            manual: [] as ManualMacronutrient[],
            ingredientsCount: 0,
          })),
      ),
    ).then((results) => {
      if (!active) return;

      setPlateManualMacrosMap((prev) => {
        const next = { ...prev };
        results.forEach((item) => {
          next[item.menuId] = item.manual;
        });
        return next;
      });

      setPlateIngredientCountMap((prev) => {
        const next = { ...prev };
        results.forEach((item) => {
          next[item.menuId] = item.ingredientsCount;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [plateIngredientCountMap, plateManualMacrosMap, plateMenuIds]);

  const plateNutrition = useMemo(
    () =>
      piringkuMenus.reduce(
        (acc, m) => {
          acc.kalori += Number(m.kalori || 0);
          acc.protein += Number(m.protein || 0);
          acc.lemak += Number(m.lemak || 0);
          acc.karbo += Number(m.karbohidrat || 0);
          return acc;
        },
        { kalori: 0, protein: 0, lemak: 0, karbo: 0 },
      ),
    [piringkuMenus],
  );

  const microStatus = useMemo(() => {
    const dynamicMap: Record<
      string,
      {
        key: string;
        label: string;
        unit: string;
        color: string;
        value: number;
        target: number | null;
        percent: number;
        statusLabel: string;
        statusClass: string;
      }
    > = {};

    let paletteIndex = 0;
    const targets = AKG_MICRO_TARGETS[kelompok];

    const ensureField = (name: string, unit: string) => {
      const normalized = normalizeNutrientName(name || "");
      if (!normalized) return null;
      const target = targets[normalized];

      if (!dynamicMap[normalized]) {
        const color =
          MANUAL_NUTRIENT_COLORS[paletteIndex % MANUAL_NUTRIENT_COLORS.length];
        paletteIndex += 1;

        dynamicMap[normalized] = {
          key: `manual-${normalized.replace(/\s+/g, "-")}`,
          label: target?.label || name || "Nutrien Tambahan",
          unit: target?.unit || unit || "g",
          color,
          value: 0,
          target: target?.target || null,
          percent: 0,
          statusLabel: "Tercatat",
          statusClass: "text-emerald-600",
        };
      }

      return dynamicMap[normalized];
    };

    piringkuMenus.forEach((menu) => {
      [
        { name: "Serat", value: Number(menu.serat || 0), unit: "g" },
        { name: "Gula", value: Number(menu.gula || 0), unit: "g" },
      ].forEach((item) => {
        if (item.value <= 0) return;
        const field = ensureField(item.name, item.unit);
        if (field) field.value += item.value;
      });

      const manualList =
        plateManualMacrosMap[menu.id] || menu.manual_macronutrients || [];

      manualList.forEach((macro) => {
        const normalized = normalizeNutrientName(macro.nama || "");
        if (!normalized) return;

        const numericValue = Number(macro.nilai || 0);
        if (!Number.isFinite(numericValue)) return;

        const field = ensureField(macro.nama || "Nutrien", macro.satuan || "g");
        if (!field) return;
        field.value += convertNutrientUnit(
          numericValue,
          macro.satuan || field.unit,
          field.unit,
        );
      });
    });

    const dynamicFields = Object.values(dynamicMap);
    return dynamicFields.map((item) => {
      if (item.value <= 0) {
        return {
          ...item,
          percent: 0,
          statusLabel: "Kurang",
          statusClass: "text-emerald-400",
        };
      }

      if (!item.target) {
        return {
          ...item,
          percent: 100,
          statusLabel: "Tercatat",
          statusClass: "text-emerald-600",
        };
      }

      const percent = Math.round((item.value / item.target) * 100);
      const status = getAkgStatus(percent);

      return {
        ...item,
        percent,
        statusLabel: status.label,
        statusClass: status.textClass,
      };
    });
  }, [kelompok, piringkuMenus, plateManualMacrosMap]);

  const std = STANDAR[kelompok];
  const rows = [
    {
      label: "Kalori",
      val: plateNutrition.kalori,
      target: std.kalori,
      unit: "kkal",
    },
    {
      label: "Protein",
      val: plateNutrition.protein,
      target: std.protein,
      unit: "g",
    },
    {
      label: "Karbo",
      val: plateNutrition.karbo,
      target: std.karbo,
      unit: "g",
    },
    {
      label: "Lemak",
      val: plateNutrition.lemak,
      target: std.lemak,
      unit: "g",
    },
  ].map((row) => {
    const percent =
      row.target > 0 ? Math.round((row.val / row.target) * 100) : 0;
    return {
      ...row,
      percent,
      status: getAkgStatus(percent),
    };
  });

  const visibleRows = rows.filter((row) => row.val > 0);
  const analysisRows =
    plateAiAnalysis && Object.keys(plateAiAnalysis.detail_analisis).length > 0
      ? Object.entries(plateAiAnalysis.detail_analisis)
          .map(([key, data]) => ({
            key,
            label: data.label,
            val: Number(data.value || 0),
            target: data.target ?? null,
            unit: data.unit,
            percent:
              typeof data.percent === "number"
                ? data.percent
                : data.target
                  ? Math.round((Number(data.value || 0) / data.target) * 100)
                  : null,
            status:
              typeof data.percent === "number"
                ? getAkgStatus(data.percent)
                : data.target
                  ? getAkgStatus(
                      Math.round((Number(data.value || 0) / data.target) * 100),
                    )
                  : null,
            statusLabel: data.status,
            category: data.category || "micro",
          }))
          .filter((row) => row.val > 0)
          .sort((a, b) => {
            const order = [
              "kalori",
              "protein",
              "karbohidrat",
              "lemak",
              "serat",
              "gula",
            ];
            const ai = order.indexOf(a.key);
            const bi = order.indexOf(b.key);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          })
      : visibleRows.map((row) => ({
          key: row.label.toLowerCase(),
          label: row.label,
          val: row.val,
          target: row.target,
          unit: row.unit,
          percent: row.percent,
          status: row.status,
          statusLabel: row.status.label,
          category: "macro",
        }));
  const aggregateScores = [
    ...visibleRows.map((row) => Math.min(130, Math.max(0, row.percent))),
    ...microStatus.map((item) => item.percent),
  ];
  const plateAkgPercent =
    aggregateScores.length > 0
      ? Math.round(
          aggregateScores.reduce((sum, value) => sum + value, 0) /
            aggregateScores.length,
        )
      : 0;
  const plateAkgStatus = getAkgStatus(plateAkgPercent);

  const macroTotal =
    plateNutrition.protein + plateNutrition.karbo + plateNutrition.lemak;
  const microTotal = microStatus.reduce((sum, item) => sum + item.value, 0);

  const slices = [
    {
      key: "karbo",
      label: "Karbohidrat",
      value: plateNutrition.karbo,
      color: "#8b5cf6",
    },
    {
      key: "protein",
      label: "Protein",
      value: plateNutrition.protein,
      color: "#10b981",
    },
    {
      key: "lemak",
      label: "Lemak",
      value: plateNutrition.lemak,
      color: "#f59e0b",
    },
  ].filter((slice) => slice.value > 0);

  const dataWarnings = plateAiAnalysis?.data_quality?.warnings || [];
  const retryPlateAi = () => runPlateAnalysis();

  const addMenu = (id: number) =>
    setPlateMenuIds((prev) =>
      prev.includes(id) ? prev : [...prev, id].slice(-3),
    );

  const removeMenu = (id: number) =>
    setPlateMenuIds((prev) => prev.filter((x) => x !== id));

  const assignMenuToDay = (dateKey: string, menuId: number) => {
    setWeeklyPlanByLocation((prevByLocation) => {
      const prev = prevByLocation[activeLocationId] || {};
      const dayPlan = normalizeDayPlan(prev[dateKey]);
      const current = getDayMenuIds(dayPlan);
      if (current.includes(menuId)) return prevByLocation;

      const nextPlan = {
        ...prev,
        [dateKey]: {
          makananIds: [...current, menuId].slice(-4),
          minumanIds: [],
        },
      };

      return {
        ...prevByLocation,
        [activeLocationId]: nextPlan,
      };
    });
  };

  const removeMenuFromDay = (dateKey: string, menuId: number) => {
    setWeeklyPlanByLocation((prevByLocation) => {
      const prev = prevByLocation[activeLocationId] || {};
      const dayPlan = normalizeDayPlan(prev[dateKey]);
      const updated = getDayMenuIds(dayPlan).filter((id) => id !== menuId);
      const nextPlan = {
        ...prev,
        [dateKey]: {
          makananIds: updated,
          minumanIds: [],
        },
      };

      return {
        ...prevByLocation,
        [activeLocationId]: nextPlan,
      };
    });
  };

  const clearDayPlan = (dateKey: string) => {
    setWeeklyPlanByLocation((prevByLocation) => ({
      ...prevByLocation,
      [activeLocationId]: {
        ...(prevByLocation[activeLocationId] || {}),
        [dateKey]: createEmptyDayPlan(),
      },
    }));
  };

  const getMenusByDay = (dateKey: string) => {
    const dayPlan = normalizeDayPlan(weeklyPlan[dateKey]);
    const ids = getDayMenuIds(dayPlan);
    return ids
      .map((id) => menuLookup.get(id))
      .filter((menu): menu is Menu => Boolean(menu));
  };

  const selectDistributionLocation = (locationId: string) => {
    setActiveLocationId(locationId);
    setShowDistributionModal(false);
  };

  const shiftScheduleMonth = (offset: number) => {
    const current = dateFromKey(weeklyPeriodAnchor);
    setWeeklyPeriodAnchor(
      toDateKey(
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
      ),
    );
  };

  const confirmSaveWeeklySchedule = () => {
    setSavedScheduleMap((prev) => ({
      ...prev,
      [activeLocationId]: new Date().toISOString(),
    }));
    setShowSaveScheduleConfirm(false);
  };

  const filtered = menus.filter((m) => {
    const cleanName = sanitizeMenuName(m.nama);
    return (
      !search ||
      cleanName.toLowerCase().includes(search.toLowerCase()) ||
      m.nama.toLowerCase().includes(search.toLowerCase())
    );
  });

  const plateMenuOptions = useMemo(() => {
    const q = plateMenuSearch.trim().toLowerCase();
    return menus.filter((menu) => {
      const cleanName = sanitizeMenuName(menu.nama).toLowerCase();
      const matchesSearch =
        !q ||
        cleanName.includes(q) ||
        menu.nama.toLowerCase().includes(q) ||
        menu.kategori.toLowerCase().includes(q);
      const matchesTarget =
        plateTargetFilter === "all" ||
        menu.kategori.toLowerCase() === STANDAR[kelompok].label.toLowerCase();
      return matchesSearch && matchesTarget;
    });
  }, [kelompok, menus, plateMenuSearch, plateTargetFilter]);

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayDateNumber = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
  });
  const todayMonthYear = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const summaryWidgets: SummaryWidget[] = useMemo(() => {
    if (!stats) return [];

    const totalMenus = Number(stats.total_menus || 0);
    const locationCount = distributionLocations.length;
    const latestLocation =
      distributionLocations[distributionLocations.length - 1];
    const totalBeneficiaries = distributionLocations.reduce(
      (sum, location) =>
        sum +
        location.recipients.reduce(
          (recipientSum, recipient) =>
            recipientSum + parseTargetCount(recipient.target),
          0,
        ),
      0,
    );
    const siswaCount = distributionLocations.reduce(
      (sum, location) =>
        sum +
        location.recipients
          .filter((recipient) =>
            recipient.label.toLowerCase().includes("siswa"),
          )
          .reduce(
            (recipientSum, recipient) =>
              recipientSum + parseTargetCount(recipient.target),
            0,
          ),
      0,
    );
    const balitaCount = distributionLocations.reduce(
      (sum, location) =>
        sum +
        location.recipients
          .filter((recipient) =>
            recipient.label.toLowerCase().includes("balita"),
          )
          .reduce(
            (recipientSum, recipient) =>
              recipientSum + parseTargetCount(recipient.target),
            0,
          ),
      0,
    );
    const ibuHamilCount = distributionLocations.reduce(
      (sum, location) =>
        sum +
        location.recipients
          .filter((recipient) =>
            recipient.label.toLowerCase().includes("ibu hamil"),
          )
          .reduce(
            (recipientSum, recipient) =>
              recipientSum + parseTargetCount(recipient.target),
            0,
          ),
      0,
    );

    const scheduledLocationCount = distributionLocations.filter((location) => {
      const locationPlan = weeklyPlanByLocation[location.id] || {};
      return Object.values(locationPlan).some(
        (day) => getDayMenuIds(normalizeDayPlan(day)).length > 0,
      );
    }).length;
    const currentMonthKey = getMonthKey(new Date());
    const scheduledLocationThisMonthCount = distributionLocations.filter(
      (location) => {
        const locationPlan = weeklyPlanByLocation[location.id] || {};
        return Object.entries(locationPlan).some(
          ([dateKey, day]) =>
            dateKey.startsWith(currentMonthKey) &&
            getDayMenuIds(normalizeDayPlan(day)).length > 0,
        );
      },
    ).length;

    const completionPercent =
      locationCount > 0
        ? Math.round((scheduledLocationThisMonthCount / locationCount) * 100)
        : 0;

    const menuMeetAkgCount = menus.filter(evaluateMenuAkgStatus).length;
    const menuNeedEvalCount = Math.max(0, totalMenus - menuMeetAkgCount);

    return [
      {
        title: "Total",
        value: totalMenus,
        subtitle: "Seluruh menu tercatat",
        insight: totalMenus > 0 ? "Total Menu." : "Tambahkan menu pertama.",
        gradient: "from-forest-950 via-forest-900 to-forest-700",
        iconBg: "bg-white/10",
        icon: UtensilsCrossed,
        watermarkColor: "text-white/8",
      },
      {
        title: "Lokasi Distribusi",
        value: locationCount,
        subtitle: latestLocation?.name || EMPTY_DISTRIBUTION_LOCATION.name,
        insight: `${scheduledLocationCount} lokasi sudah punya jadwal`,
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: Users,
        watermarkColor: "text-forest-100",
      },
      {
        title: "Penerima Manfaat",
        value: totalBeneficiaries,
        subtitle: "Total penerima aktif",
        insight: `Siswa ${siswaCount}, Balita ${balitaCount}, Ibu Hamil ${ibuHamilCount}`,
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: HeartPulse,
        watermarkColor: "text-forest-100",
      },
      {
        title: "Jadwal Aktif",
        value: scheduledLocationThisMonthCount,
        subtitle: "Terisi untuk bulan ini",
        insight: `Completion ${completionPercent}%`,
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: CheckCircle2,
        watermarkColor: "text-forest-100",
      },
      {
        title: "Status Menu",
        value: `${menuMeetAkgCount}/${totalMenus}`,
        subtitle: "Memenuhi target AKG",
        insight: `${menuNeedEvalCount} menu perlu evaluasi`,
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: Gauge,
        watermarkColor: "text-forest-100",
      },
    ];
  }, [
    distributionLocations.length,
    distributionLocations,
    menus,
    stats,
    weeklyPlanByLocation,
  ]);

  const clearDragGhost = () => {
    if (dragGhostRef.current && dragGhostRef.current.parentNode) {
      dragGhostRef.current.parentNode.removeChild(dragGhostRef.current);
    }
    dragGhostRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearDragGhost();
    };
  }, []);

  const handleCardDragStart = (
    e: DragEvent<HTMLDivElement>,
    menuId: number,
  ) => {
    setDraggingMenuId(menuId);
    e.dataTransfer.setData("menu-id", String(menuId));
    e.dataTransfer.effectAllowed = "copy";

    const source = e.currentTarget;
    const rect = source.getBoundingClientRect();
    const menu = menuLookup.get(menuId);
    const ghost = document.createElement("div");
    const imageUrl = resolveMenuImageUrl(menu?.gambar_url);
    const displayName = escapeHtml(
      sanitizeMenuName(menu?.nama || "") || menu?.nama || "",
    );
    const menuCategory = escapeHtml(menu?.kategori || "Menu");

    ghost.innerHTML = `
      <div style="display:flex;gap:12px;align-items:stretch;width:100%;">
        <div style="width:96px;min-width:96px;height:96px;border-radius:14px;overflow:hidden;background:#f3f4f6;">
          ${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-weight:800;">MENU</div>`
          }
        </div>
        <div style="min-width:0;flex:1;padding:2px 0;">
          <div style="font-size:14px;font-weight:800;color:#243127;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</div>
          <div style="margin-top:6px;font-size:11px;color:#647066;">${menuCategory} - ${menu?.kalori ?? 0} kkal</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px;">
            ${[
              ["P", menu?.protein ?? 0, "#10b981"],
              ["K", menu?.karbohidrat ?? 0, "#8b5cf6"],
              ["L", menu?.lemak ?? 0, "#f59e0b"],
            ]
              .map(
                ([label, value, color]) =>
                  `<div style="border:1px solid #dfeee4;border-radius:10px;padding:6px;background:#f7fbf8;">
                    <div style="font-size:9px;font-weight:800;color:${color};">${label}</div>
                    <div style="font-size:12px;font-weight:800;color:#243127;">${value}g</div>
                  </div>`,
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.width = `${Math.max(300, Math.min(380, rect.width + 54))}px`;
    ghost.style.maxWidth = "380px";
    ghost.style.padding = "10px";
    ghost.style.background = "white";
    ghost.style.border = "1px solid rgba(34, 197, 94, 0.28)";
    ghost.style.opacity = "0.97";
    ghost.style.transform = "rotate(-2deg) scale(0.98)";
    ghost.style.borderRadius = "18px";
    ghost.style.boxShadow = "0 24px 38px rgba(15, 23, 42, 0.32)";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";

    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    e.dataTransfer.setDragImage(
      ghost,
      Math.max(18, e.clientX - rect.left),
      Math.max(18, e.clientY - rect.top),
    );
  };

  const handleCardDragEnd = () => {
    setDraggingMenuId(null);
    setDragOverTarget(null);
    clearDragGhost();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="page-shell space-y-6"
    >
      {!isWeeklyOnly && (
        <>
          <div className="page-header">
            <div>
              <span className="soft-badge">Operations Overview</span>
              <h1 className="page-title mt-4">Dashboard MBG</h1>
              <p className="page-subtitle">
                Pantau menu, evaluasi nutrisi, dan susun jadwal mingguan dalam
                satu workspace yang lebih lega dan fokus.
              </p>
            </div>
            <div className="card min-w-[220px] rounded-[30px] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                    Tanggal Hari Ini
                  </p>
                  <p className="mt-2 text-5xl font-black leading-none text-forest-900">
                    {todayDateNumber}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-ink-700">
                    {todayMonthYear}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">{today}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-forest-50 text-forest-800">
                  <CalendarDays className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {summaryWidgets.map((widget, idx) => {
              const Icon = widget.icon;
              const isPrimary = idx === 0;
              return (
                <motion.div
                  key={widget.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`relative cursor-default overflow-hidden rounded-[30px] border p-6 transition-all hover:-translate-y-1 hover:shadow-2xl ${
                    isPrimary
                      ? `bg-linear-to-br ${widget.gradient} border-white/10 text-white shadow-[0_24px_54px_rgba(23,59,35,0.22)]`
                      : `night-panel-accent bg-linear-to-br ${widget.gradient} border-ink-100 text-ink-700 shadow-[0_16px_36px_rgba(36,49,39,0.07)]`
                  }`}
                >
                  <Icon
                    className={`pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 ${widget.watermarkColor} opacity-20`}
                  />
                  <div
                    className={`absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full ${
                      isPrimary ? "bg-white/5" : "bg-forest-50"
                    }`}
                  />

                  <div className="relative z-10">
                    <div className="mb-3 flex items-center justify-between">
                      <p
                        className={`text-xs font-semibold uppercase tracking-wider ${
                          isPrimary ? "text-white/70" : "text-ink-400"
                        }`}
                      >
                        {widget.title}
                      </p>
                      <div className={`${widget.iconBg} rounded-xl p-2`}>
                        <Icon
                          className={`h-4 w-4 ${isPrimary ? "text-white" : "text-forest-800"}`}
                        />
                      </div>
                    </div>
                    <p className="mb-1 text-4xl font-black leading-tight">
                      {widget.value}
                    </p>
                    <p
                      className={`text-sm font-semibold leading-5 ${
                        isPrimary ? "text-white/80" : "text-ink-600"
                      }`}
                    >
                      {widget.subtitle}
                    </p>
                    <p
                      className={`mt-3 border-t pt-3 text-xs font-bold leading-5 ${
                        isPrimary
                          ? "border-white/20 text-white/90"
                          : "border-forest-200 text-forest-900"
                      }`}
                    >
                      {widget.insight}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="card overflow-hidden rounded-[34px] border border-ink-100/60 bg-white/95 shadow-sm"
            >
              <div className="night-panel-accent bg-[linear-gradient(135deg,#ffffff_0%,#f7fbf7_55%,#eef8ef_100%)] p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-forest-800 shadow-sm">
                      <Sparkles className="h-3.5 w-3.5" />
                      Piringku vs AKG 2019
                    </span>
                    <h2 className="mt-3 text-2xl font-black tracking-normal text-ink-700">
                      Monitor Piringku vs AKG 2019
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-400">
                      Gabungkan satu atau beberapa menu, lalu bandingkan total
                      nutrisi terhadap target AKG.
                    </p>
                  </div>
                  <div className="night-surface rounded-[24px] border border-forest-100 bg-white/90 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">
                          Target User
                        </p>
                        <p className="text-sm font-bold text-ink-700">
                          {STANDAR[kelompok].label}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {TARGET_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setKelompok(tab.key)}
                        data-active={kelompok === tab.key}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-[20px] border border-ink-100 bg-white px-3 py-3 text-xs font-bold text-ink-500 shadow-sm transition hover:border-forest-200 hover:bg-forest-50 data-[active=true]:border-forest-100 data-[active=true]:bg-forest-50 data-[active=true]:text-forest-900"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {STANDAR[tab.key].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-5 p-4 sm:p-6">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
                  <button
                    onClick={() => setShowPlateMenuModal(true)}
                    className="night-surface flex min-h-14 items-center justify-between gap-3 rounded-[22px] border border-ink-100 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition hover:border-forest-200 hover:bg-forest-50"
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {selectedMenuId
                        ? sanitizeMenuName(
                            menuLookup.get(selectedMenuId)?.nama ||
                              "Pilih menu",
                          )
                        : "Cari menu untuk mulai analisis piringku"}
                    </span>
                    <Search className="h-4 w-4 shrink-0 text-forest-700" />
                  </button>
                  <button
                    onClick={() => selectedMenuId && addMenu(selectedMenuId)}
                    disabled={!selectedMenuId}
                    className="btn-primary inline-flex min-h-14 items-center justify-center gap-2 px-6 text-sm disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah ke Piringku
                  </button>
                  <button
                    onClick={runPlateAnalysis}
                    disabled={plateMenuIds.length === 0 || plateAiLoading}
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[22px] border border-forest-700 bg-forest-800 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-forest-900 disabled:opacity-50"
                  >
                    {plateAiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Analisis AI
                  </button>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = Number(e.dataTransfer.getData("menu-id"));
                    if (id) addMenu(id);
                  }}
                  className="rounded-[30px] border border-forest-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf7_100%)] p-3 shadow-sm sm:p-4"
                >
                  {piringkuMenus.length === 0 ? (
                    <div className="grid min-h-72 place-items-center rounded-[26px] border border-dashed border-forest-200 bg-white/70 p-6 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-forest-50 text-forest-800">
                        <ChefHat className="h-8 w-8" />
                      </div>
                      <div className="mt-4 max-w-md">
                        <h3 className="text-lg font-bold text-ink-700">
                          No Menu Selected
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-ink-400">
                          Belum ada data nutrisi untuk ditampilkan. Tambahkan
                          menu atau seret kartu dari daftar bawah.
                        </p>
                      </div>
                      <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                        {[0, 1, 2].map((item) => (
                          <div
                            key={item}
                            className="nutrition-shimmer h-24 rounded-[22px] border border-ink-100 bg-white"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                            Menu Terpilih
                          </p>
                          <h3 className="mt-1 text-xl font-black text-ink-700">
                            {piringkuMenus.length} widget menu aktif
                          </h3>
                        </div>
                        <span
                          className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${plateAkgStatus.badgeClass}`}
                        >
                          Total Piringku: {plateAkgPercent}% -{" "}
                          {plateAkgStatus.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {piringkuMenus.map((menu) => {
                          const imageUrl = resolveMenuImageUrl(menu.gambar_url);
                          const displayName =
                            sanitizeMenuName(menu.nama) || menu.nama;
                          const menuMacroTotal =
                            Number(menu.protein || 0) +
                            Number(menu.karbohidrat || 0) +
                            Number(menu.lemak || 0);
                          const menuPercent = Math.round(
                            (Number(menu.kalori || 0) /
                              STANDAR[kelompok].kalori) *
                              100,
                          );
                          const menuStatus = getAkgStatus(menuPercent);
                          const menuSlices = [
                            {
                              key: "karbo",
                              label: "Karbohidrat",
                              value: Number(menu.karbohidrat || 0),
                              color: "#8b5cf6",
                            },
                            {
                              key: "protein",
                              label: "Protein",
                              value: Number(menu.protein || 0),
                              color: "#10b981",
                            },
                            {
                              key: "lemak",
                              label: "Lemak",
                              value: Number(menu.lemak || 0),
                              color: "#f59e0b",
                            },
                          ].filter((item) => item.value > 0);

                          return (
                            <div
                              key={menu.id}
                              className="night-surface grid overflow-hidden rounded-[28px] border border-ink-100 bg-white shadow-sm sm:grid-cols-[180px_1fr]"
                            >
                              <div className="relative min-h-52 bg-forest-50 sm:min-h-full">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={displayName}
                                    className="h-full min-h-52 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full min-h-52 items-center justify-center text-forest-700">
                                    <ChefHat className="h-12 w-12" />
                                  </div>
                                )}
                                <div className="night-chip absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-bold text-forest-900 shadow-sm">
                                  1 Porsi
                                </div>
                              </div>

                              <div className="flex min-w-0 flex-col gap-4 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                                      Target {STANDAR[kelompok].label}
                                    </p>
                                    <h4 className="mt-1 line-clamp-2 text-lg font-black text-ink-700">
                                      {displayName}
                                    </h4>
                                  </div>
                                  <button
                                    onClick={() => removeMenu(menu.id)}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                    title="Hapus dari Piringku"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    [
                                      `${Math.round(Number(menu.kalori || 0))}`,
                                      "kkal",
                                    ],
                                    [
                                      `${plateIngredientCountMap[menu.id] || 0}`,
                                      "komponen",
                                    ],
                                    [`${menuPercent}%`, "AKG"],
                                  ].map(([value, label]) => (
                                    <div
                                      key={label}
                                      className="rounded-[18px] border border-ink-100 bg-forest-25 px-3 py-2"
                                    >
                                      <p className="text-sm font-black text-ink-700">
                                        {value}
                                      </p>
                                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
                                        {label}
                                      </p>
                                    </div>
                                  ))}
                                </div>

                                <span
                                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${menuStatus.badgeClass}`}
                                >
                                  {menuStatus.label}
                                </span>

                                <div className="space-y-2">
                                  {menuSlices.map((slice) => {
                                    const percent =
                                      menuMacroTotal > 0
                                        ? Math.round(
                                            (slice.value / menuMacroTotal) *
                                              100,
                                          )
                                        : 0;
                                    return (
                                      <div
                                        key={slice.key}
                                        className="flex items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span
                                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                                            style={{
                                              backgroundColor: slice.color,
                                            }}
                                          />
                                          <span className="truncate font-bold text-ink-700">
                                            {slice.label}
                                          </span>
                                        </div>
                                        <span className="font-semibold text-ink-400">
                                          {Math.round(slice.value)} g -{" "}
                                          {percent}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {piringkuMenus.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-[30px] border border-ink-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                              Ringkasan AKG Harian
                            </p>
                            <h3 className="mt-1 text-lg font-black text-ink-700">
                              Capaian Total Piringku
                            </h3>
                          </div>
                          <Gauge className="h-5 w-5 text-forest-800" />
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
                          <div className="relative mx-auto flex h-52 w-52 items-center justify-center">
                            <svg
                              viewBox="0 0 44 44"
                              className="h-full w-full -rotate-90"
                            >
                              <circle
                                cx="22"
                                cy="22"
                                r="18"
                                fill="none"
                                stroke="#e8eee8"
                                strokeWidth="5"
                              />
                              <motion.circle
                                cx="22"
                                cy="22"
                                r="18"
                                fill="none"
                                stroke={plateAkgStatus.ringColor}
                                strokeLinecap="round"
                                strokeWidth="5"
                                initial={{ pathLength: 0 }}
                                animate={{
                                  pathLength: Math.min(
                                    1.3,
                                    plateAkgPercent / 100,
                                  ),
                                }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                              <span
                                className={`text-5xl font-black ${plateAkgStatus.textClass}`}
                              >
                                {plateAkgPercent}%
                              </span>
                              <span className="mt-1 text-xs font-bold text-ink-400">
                                skor gabungan
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${plateAkgStatus.badgeClass}`}
                            >
                              {plateAkgStatus.label}
                            </span>
                            <p className="text-sm leading-6 text-ink-500">
                              Status dihitung dari kalori, komposisi makro, dan
                              mikronutrien yang tersedia pada menu.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {visibleRows.slice(0, 4).map((row) => (
                                <div
                                  key={row.label}
                                  className="rounded-[18px] border border-ink-100 bg-forest-25 px-3 py-3"
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
                                    {row.label}
                                  </p>
                                  <p className="mt-1 text-sm font-black text-ink-700">
                                    {Math.round(row.val)} / {row.target}{" "}
                                    {row.unit}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="night-panel-accent rounded-[30px] border border-ink-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbf7_100%)] p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                              Komposisi Makronutrien
                            </p>
                            <h3 className="mt-1 text-lg font-black text-ink-700">
                              Macro Composition
                            </h3>
                          </div>
                          <span className="night-chip rounded-full bg-white px-3 py-1.5 text-xs font-bold text-forest-800 shadow-sm">
                            {Math.round(macroTotal)} g total
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
                          <CompositionDonut
                            segments={slices}
                            centerValue={`${Math.round(macroTotal)} g`}
                            centerLabel="total makro"
                          />

                          <div className="space-y-3">
                            {slices.map((slice) => {
                              const percent =
                                macroTotal > 0
                                  ? Math.round((slice.value / macroTotal) * 100)
                                  : 0;
                              const kcal =
                                slice.key === "lemak"
                                  ? Math.round(slice.value * 9)
                                  : Math.round(slice.value * 4);
                              const row = rows.find(
                                (item) =>
                                  item.label.toLowerCase() ===
                                  (slice.key === "karbo" ? "karbo" : slice.key),
                              );

                              return (
                                <div
                                  key={slice.key}
                                  className="night-surface rounded-[22px] border border-ink-100 bg-white px-4 py-3 shadow-sm"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <span
                                        className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                        style={{
                                          backgroundColor: `${slice.color}18`,
                                          color: slice.color,
                                        }}
                                      >
                                        {slice.key === "protein" ? (
                                          <ProteinIcon className="h-5 w-5" />
                                        ) : slice.key === "lemak" ? (
                                          <FatIcon className="h-5 w-5" />
                                        ) : (
                                          <CarboIcon className="h-5 w-5" />
                                        )}
                                      </span>
                                      <div>
                                        <p className="text-sm font-bold text-ink-700">
                                          {slice.label}
                                        </p>
                                        <p className="text-xs text-ink-400">
                                          {Math.round(slice.value)} g - {kcal}{" "}
                                          kkal
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-black text-ink-700">
                                        {percent}%
                                      </p>
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${row?.status.badgeClass || ""}`}
                                      >
                                        {row?.status.label || "Baik"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-[30px] border border-ink-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                              Perbandingan Detail Zat Gizi
                            </p>
                            <h3 className="mt-1 text-lg font-black text-ink-700">
                              Asupan vs AKG 2019
                            </h3>
                          </div>
                          <Scale className="h-5 w-5 text-forest-800" />
                        </div>

                        {analysisRows.length === 0 ? (
                          <div className="rounded-[22px] border border-dashed border-ink-100 bg-gray-50 p-5 text-sm text-ink-400">
                            Belum ada data nutrisi untuk dibandingkan.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {analysisRows.map((row) => (
                              <div
                                key={row.key}
                                className="grid grid-cols-1 gap-3 rounded-[22px] border border-ink-100 bg-white px-4 py-4 shadow-sm md:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_auto] md:items-center"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                                    {row.label === "Kalori" ? (
                                      <CalorieIcon className="h-5 w-5" />
                                    ) : row.label === "Protein" ? (
                                      <ProteinIcon className="h-5 w-5" />
                                    ) : row.label === "Lemak" ? (
                                      <FatIcon className="h-5 w-5" />
                                    ) : (
                                      <CarboIcon className="h-5 w-5" />
                                    )}
                                  </span>
                                  <p className="font-bold text-ink-700">
                                    {row.label}
                                  </p>
                                </div>
                                <p className="text-sm text-ink-500">
                                  {Math.round(row.val)} {row.unit}
                                </p>
                                <p className="text-sm text-ink-500">
                                  {row.target
                                    ? `${row.target} ${row.unit}`
                                    : "-"}
                                </p>
                                <p className="text-sm font-black text-ink-700">
                                  {row.percent !== null
                                    ? `${row.percent}%`
                                    : "-"}
                                </p>
                                <span
                                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                                    row.status?.badgeClass ||
                                    "border border-forest-100 bg-forest-50 text-forest-800"
                                  }`}
                                >
                                  {row.statusLabel}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-[30px] border border-ink-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                              Mikronutrien
                            </p>
                            <h3 className="mt-1 text-lg font-black text-ink-700">
                              Data Tambahan Menu
                            </h3>
                          </div>
                          <FlaskConical className="h-5 w-5 text-forest-800" />
                        </div>

                        {microStatus.length === 0 ? (
                          <div className="rounded-[24px] border border-dashed border-ink-100 bg-forest-25 p-6 text-center">
                            <Leaf className="mx-auto h-8 w-8 text-forest-700" />
                            <p className="mt-3 text-sm font-bold text-ink-700">
                              Belum ada data mikronutrien
                            </p>
                            <p className="mt-1 text-xs leading-5 text-ink-400">
                              Tambahkan nutrien manual pada menu agar progres
                              mikro muncul di sini.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-5 md:grid-cols-[190px_1fr]">
                            <CompositionDonut
                              segments={microStatus.map((field) => ({
                                key: field.key,
                                label: field.label,
                                value: field.value,
                                color: field.color,
                              }))}
                              centerValue={`${Math.round(microTotal * 10) / 10}`}
                              centerLabel="total mikro"
                              sizeClass="h-48 w-48"
                            />

                            <div className="space-y-3">
                              {microStatus.map((field) => {
                                const shownValue =
                                  Math.round(field.value * 10) / 10;

                                return (
                                  <div
                                    key={field.key}
                                    className="rounded-[20px] border border-ink-100 bg-white px-3 py-3 shadow-sm"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span
                                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                          style={{
                                            backgroundColor: `${field.color}18`,
                                          }}
                                        >
                                          <NutrientAssetIcon
                                            name={field.label}
                                            className="h-6 w-6"
                                          />
                                        </span>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-bold text-ink-700">
                                            {field.label}
                                          </p>
                                          <p className="text-xs text-ink-400">
                                            {shownValue} {field.unit}
                                            {field.target
                                              ? ` / ${field.target} ${field.unit}`
                                              : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-black text-ink-700">
                                          {field.percent}%
                                        </p>
                                        <p
                                          className={`text-[11px] font-bold ${field.statusClass}`}
                                        >
                                          {field.statusLabel}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {dataWarnings.length > 0 && (
                      <div className="rounded-[26px] border border-amber-100 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                          <div>
                            <p className="text-sm font-bold text-amber-900">
                              Data belum lengkap
                            </p>
                            <div className="mt-1 space-y-1">
                              {dataWarnings.map((warning) => (
                                <p
                                  key={warning}
                                  className="text-sm leading-6 text-amber-800"
                                >
                                  {warning}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                      {plateAiLoading ? (
                        [
                          "AI sedang menganalisis komposisi menu...",
                          "Menyusun catatan ahli gizi...",
                          "Menghasilkan tips dan kesimpulan...",
                        ].map((text) => (
                          <div
                            key={text}
                            className="flex min-h-44 flex-col items-center justify-center rounded-[30px] border border-forest-100 bg-white p-6 text-center shadow-sm"
                          >
                            <Loader2 className="h-7 w-7 animate-spin text-forest-800" />
                            <p className="mt-4 text-sm font-bold leading-6 text-ink-700">
                              {text}
                            </p>
                          </div>
                        ))
                      ) : plateAiError ? (
                        <div className="xl:col-span-3 rounded-[30px] border border-red-100 bg-red-50 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                              <div>
                                <p className="text-sm font-bold text-red-800">
                                  OpenAI/Gemini/DeepSeek API wajib untuk
                                  analisis dashboard
                                </p>
                                <p className="mt-1 text-sm text-red-700">
                                  {plateAiError}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={retryPlateAi}
                              className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-red-700 shadow-sm"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Retry
                            </button>
                          </div>
                        </div>
                      ) : plateAiAnalysis ? (
                        <>
                          <div className="rounded-[30px] border border-violet-100 bg-violet-50/70 p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm">
                                <Info className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-black text-violet-900">
                                  Catatan AI
                                </p>
                                <p className="text-xs text-violet-700/70">
                                  {plateAiAnalysis.ai_engine}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm leading-7 text-violet-950/80">
                              {plateAiAnalysis.catatan_ai}
                            </p>
                          </div>

                          <div className="rounded-[30px] border border-amber-100 bg-amber-50/80 p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                                <Sparkles className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-black text-amber-900">
                                  Tips AI
                                </p>
                                <p className="text-xs text-amber-700/70">
                                  Rekomendasi praktis
                                </p>
                              </div>
                            </div>
                            <p className="text-sm leading-7 text-amber-950/80">
                              {plateAiAnalysis.tips_ai}
                            </p>
                          </div>

                          <div className="rounded-[30px] border border-forest-100 bg-forest-50/80 p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-forest-800 shadow-sm">
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-black text-forest-950">
                                  Kesimpulan AI
                                </p>
                                <p className="text-xs text-forest-700/70">
                                  {plateAiAnalysis.ai_engine}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm leading-7 text-forest-950/80">
                              {plateAiAnalysis.kesimpulan_ai}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="xl:col-span-3 rounded-[30px] border border-forest-100 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-50 text-forest-800">
                                <Sparkles className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-ink-700">
                                  Analisis belum dijalankan
                                </p>
                                <p className="mt-1 text-sm leading-6 text-ink-400">
                                  Pilih menu Piringku, lalu tekan Analisis AI.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={runPlateAnalysis}
                              disabled={plateMenuIds.length === 0}
                              className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-forest-800 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                            >
                              <Sparkles className="h-4 w-4" />
                              Jalankan Analisis
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card rounded-4xl p-4 xl:self-start xl:p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-2xl bg-forest-50 p-2.5">
              <Gauge className="h-5 w-5 text-forest-800" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                Average Nutrition
              </p>
              <h2 className="text-lg font-bold text-gray-800">
                Rata-rata Nutrisi
              </h2>
              <p className="text-sm text-gray-400">
                Dari seluruh menu yang tersedia
              </p>
            </div>
          </div>

          {stats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Kalori",
                    value: Number(stats.avg_nutrition?.avg_kalori || 0),
                    target: 550,
                    unit: "kkal",
                    color: "#ef4444",
                  },
                  {
                    label: "Protein",
                    value: Number(stats.avg_nutrition?.avg_protein || 0),
                    target: 25,
                    unit: "g",
                    color: "#10b981",
                  },
                  {
                    label: "Lemak",
                    value: Number(stats.avg_nutrition?.avg_lemak || 0),
                    target: 18,
                    unit: "g",
                    color: "#f59e0b",
                  },
                  {
                    label: "Karbohidrat",
                    value: Number(stats.avg_nutrition?.avg_karbohidrat || 0),
                    target: 75,
                    unit: "g",
                    color: "#8b5cf6",
                  },
                ].map((row) => {
                  const pct = Math.max(
                    0,
                    Math.min(100, Math.round((row.value / row.target) * 100)),
                  );
                  return (
                    <div
                      key={row.label}
                      className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-700">
                          {row.label}
                        </span>
                        <span className="font-medium text-gray-500">
                          {Math.round(row.value)}
                          <span className="ml-1 text-xs text-gray-400">
                            {row.unit}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Distribusi Kategori
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.per_kategori?.map((k) => (
                    <div
                      key={k.kategori}
                      className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5"
                    >
                      <span className="text-xs font-bold text-gray-700">
                        {k.kategori}
                      </span>
                      <span className="rounded-full bg-forest-100 px-1.5 py-0.5 text-[10px] font-bold text-forest-800">
                        {k.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div> */}
          </div>
        </>
      )}

      <div
        className={isWeeklyOnly ? "card rounded-[32px] p-5 sm:p-6" : "hidden"}
      >
        <div className="mb-5 rounded-[28px] border border-forest-200/70 bg-[linear-gradient(180deg,#f7fbf6_0%,#ffffff_100%)] p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                Widget Mingguan
              </p>
              <h3 className="mt-2 text-lg font-bold text-gray-800">
                Susun Jadwal Menu Senin - Sabtu
              </h3>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                {hasActiveLocationSelection ? (
                  <>
                    Jadwal aktif untuk{" "}
                    <span className="font-semibold text-forest-800">
                      {activeLocation.name}
                    </span>{" "}
                    ({activeLocationRecipients}).
                  </>
                ) : (
                  <span className="font-semibold text-amber-700">
                    {distributionLocations.length === 0
                      ? "Belum ada lokasi yang ditetapkan."
                      : "Silahkan pilih lokasi terlebih dahulu."}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-forest-100 bg-white px-4 py-2 text-xs font-semibold text-forest-700 shadow-sm">
                {totalScheduledCount} menu terjadwal
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm ${
                  activeLocationSaved
                    ? "border-forest-200 bg-forest-50 text-forest-800"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                {activeLocationSaved ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock3 className="h-3.5 w-3.5" />
                )}
                {activeLocationSaved
                  ? "Sudah dijadwalkan"
                  : "Belum dijadwalkan"}
              </span>
              <button
                onClick={() => openDistributionModal()}
                className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-white px-4 py-2 text-xs font-semibold text-forest-700 hover:bg-forest-50"
              >
                <CalendarDays className="h-3.5 w-3.5" /> Lokasi Distribusi
              </button>
              <button
                onClick={() => setShowSchedulePeriodModal(true)}
                className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-white px-4 py-2 text-xs font-semibold text-forest-700 hover:bg-forest-50"
              >
                <Clock3 className="h-3.5 w-3.5" /> Periode
              </button>
              <button
                onClick={() => setShowSaveScheduleConfirm(true)}
                disabled={!hasActiveLocationSelection}
                className="inline-flex items-center gap-1 rounded-full border border-forest-700 bg-forest-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-forest-900 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Simpan Jadwal Mingguan
              </button>
            </div>
          </div>

          {hasActiveLocationSelection ? (
            <>
              <div className="night-surface mb-5 overflow-hidden rounded-[26px] border border-forest-100 bg-white shadow-sm">
                <div className="relative min-h-[150px] p-5">
                  <div className="relative z-10 max-w-2xl">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                      Lokasi Distribusi
                    </p>
                    <div className="mt-3 flex items-start gap-3">
                        <div className="night-surface-strong flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-forest-100 bg-forest-50 text-forest-800 shadow-sm">
                        <Users className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xl font-bold text-gray-800">
                          {activeLocation.name}
                        </h4>
                        {activeLocation.recipients.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {activeLocation.recipients.map((recipient) => (
                              <span
                                key={recipient.label}
                                className="rounded-full border border-forest-100 bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800"
                              >
                                {recipient.label}: {recipient.target}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm font-semibold text-amber-700">
                            Belum ada lokasi yang ditetapkan
                          </p>
                        )}
                        <p className="mt-3 text-sm leading-6 text-gray-500">
                          Periode {weekPeriod}. {activeLocation.note}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden md:block">
                    <img
                      src={activeLocation.image}
                      alt={activeLocation.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-r from-white via-white/72 to-white/5" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {weekDays.map((day) => {
                  const holidayName = holidayMap[day.dateKey];
                  const isHoliday = Boolean(holidayName);
                  const dayPlan = normalizeDayPlan(weeklyPlan[day.dateKey]);
                  const dayMenus = getMenusByDay(day.dateKey);
                  const totalDayItems = getDayMenuIds(dayPlan).length;
                  const isFilled = totalDayItems > 0;

                  return (
                    <div
                      key={day.dateKey}
                      className={`min-h-[250px] rounded-[24px] border p-3 transition-all ${
                        isHoliday
                          ? "border-red-200 bg-red-50/45"
                          : day.isToday
                            ? "border-forest-500 bg-white shadow-[0_18px_32px_rgba(46,125,50,0.10)]"
                            : isFilled
                              ? "border-forest-200 bg-forest-50/35"
                              : "border-gray-200 bg-white/90"
                      } hover:-translate-y-0.5 hover:shadow-md`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p
                            className={`text-sm font-bold ${
                              day.isToday ? "text-forest-800" : "text-gray-700"
                            }`}
                          >
                            {day.dayLabel}
                          </p>
                          <p className="text-xs text-gray-400">
                            {day.dateLabel}
                          </p>
                          <p className="mt-1 text-[10px] font-medium text-forest-700/70">
                            {activeLocation.name}
                          </p>
                        </div>

                        {day.isToday && (
                          <span className="rounded-full bg-forest-100 px-2 py-1 text-[10px] font-bold text-forest-700">
                            Hari Ini
                          </span>
                        )}
                        {isHoliday && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">
                            <CalendarDays className="h-3 w-3" />
                            Libur
                          </span>
                        )}
                      </div>

                      {isHoliday ? (
                        <div className="flex min-h-[176px] flex-col items-center justify-center rounded-[20px] border border-dashed border-red-200 bg-white/70 px-3 py-5 text-center">
                          <CalendarDays className="mb-3 h-8 w-8 text-red-500" />
                          <p className="text-sm font-black uppercase tracking-[0.08em] text-red-600">
                            Libur
                          </p>
                          <p className="mt-2 text-xs leading-5 text-red-500">
                            {holidayName}
                          </p>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverTarget(day.dateKey);
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget === day.dateKey) {
                              setDragOverTarget(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const menuId = Number(
                              e.dataTransfer.getData("menu-id"),
                            );
                            if (menuId) assignMenuToDay(day.dateKey, menuId);
                            setDragOverTarget(null);
                          }}
                          className={`night-dropzone min-h-[176px] rounded-[20px] border border-emerald-200 bg-emerald-50/40 px-2.5 py-2.5 transition-all ${
                            dragOverTarget === day.dateKey
                              ? "ring-2 ring-forest-300"
                              : ""
                          }`}
                        >
                          <div className="mb-2 flex items-center gap-1.5">
                            <UtensilsCrossed className="h-3.5 w-3.5 text-forest-700" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                              Menu Hari Ini
                            </p>
                          </div>

                          {dayMenus.length === 0 ? (
                            <div className="flex min-h-[126px] items-center justify-center rounded-[16px] border border-dashed border-emerald-200 bg-white/70 px-3 text-center">
                              <p className="text-[10px] leading-5 text-gray-400">
                                Drop menu ke sini
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {dayMenus.map((menu) => {
                                const thumbUrl = resolveMenuImageUrl(
                                  menu.gambar_url,
                                );
                                const displayName =
                                  sanitizeMenuName(menu.nama) || menu.nama;

                                return (
                                  <div
                                    key={`${day.dateKey}-menu-${menu.id}`}
                                    className="night-surface overflow-hidden rounded-[16px] border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md"
                                  >
                                    <div className="flex gap-2 p-2">
                                      {thumbUrl ? (
                                        <img
                                          src={thumbUrl}
                                          alt={displayName}
                                          className="h-14 w-16 shrink-0 rounded-xl object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                                          <ChefHat className="h-5 w-5" />
                                        </span>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-1">
                                          <p className="line-clamp-2 text-[10px] font-bold leading-4 text-gray-700">
                                            {displayName}
                                          </p>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeMenuFromDay(
                                                day.dateKey,
                                                menu.id,
                                              );
                                            }}
                                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                            title="Hapus dari jadwal"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                        <p className="mt-1 text-[9px] font-semibold text-gray-400">
                                          {menu.kalori ?? 0} kkal
                                        </p>
                                        <div className="mt-1.5 grid grid-cols-3 gap-1">
                                          {[
                                            {
                                              label: "P",
                                              value: menu.protein ?? 0,
                                              color: "text-emerald-700",
                                            },
                                            {
                                              label: "K",
                                              value: menu.karbohidrat ?? 0,
                                              color: "text-violet-700",
                                            },
                                            {
                                              label: "L",
                                              value: menu.lemak ?? 0,
                                              color: "text-amber-700",
                                            },
                                          ].map((item) => (
                                            <span
                                              key={item.label}
                                              className="rounded-lg bg-emerald-50 px-1 py-1 text-center text-[8px] font-bold text-gray-500"
                                            >
                                              <span className={item.color}>
                                                {item.label}
                                              </span>{" "}
                                              {item.value}g
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {!isHoliday && isFilled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearDayPlan(day.dateKey);
                          }}
                          className="mt-3 w-full rounded-[16px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          Hapus Semua Menu Hari Ini
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mb-5 flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-forest-200 bg-white/90 px-6 text-center shadow-sm">
              <div className="flex h-18 w-18 items-center justify-center rounded-full bg-forest-50 text-forest-800 shadow-sm">
                <Users className="h-9 w-9" />
              </div>
              <h4 className="mt-5 text-2xl font-black text-gray-900">
                {distributionLocations.length === 0
                  ? "Belum ada lokasi yang ditetapkan"
                  : "Silahkan pilih lokasi terlebih dahulu"}
              </h4>
              <p className="mt-3 max-w-lg text-sm leading-7 text-gray-500">
                {distributionLocations.length === 0
                  ? "Tambahkan lokasi distribusi terlebih dahulu agar widget lokasi dan hari mingguan bisa ditampilkan."
                  : "Pilih satu lokasi distribusi agar widget lokasi dan hari mingguan bisa muncul."}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-forest-500" /> Hari aktif
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Hari terisi
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-300" /> Hari kosong
            </span>
            <span className="inline-flex items-center gap-1 text-red-600">
              <CalendarDays className="h-3.5 w-3.5" /> Libur
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu untuk drag ke piringku atau jadwal minggu"
              className="flex-1 px-4 py-3 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Memuat menu...</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-2">
            {filtered.map((m) => {
              const protein = Number(m.protein || 0);
              const karbo = Number(m.karbohidrat || 0);
              const lemak = Number(m.lemak || 0);
              const isOnPlate = plateMenuIds.includes(m.id);
              const imageUrl = resolveMenuImageUrl(m.gambar_url);
              const menuPorsi =
                resolvedMenuPorsi[m.id] || inferMenuPorsi(m.kalori);
              const menuType = resolvedMenuType[m.id] || inferMenuType(m);
              const displayName = sanitizeMenuName(m.nama) || m.nama;

              return (
                <motion.div
                  key={m.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  draggable
                  onDragStartCapture={(e) =>
                    handleCardDragStart(e as DragEvent<HTMLDivElement>, m.id)
                  }
                  onDragEnd={handleCardDragEnd}
                  className={`card card-hover touch-pan-y cursor-grab overflow-hidden rounded-[30px] border bg-white transition-all active:cursor-grabbing ${
                    isOnPlate
                      ? "border-forest-400 shadow-md shadow-forest-100"
                      : "border-forest-100/70"
                  } ${draggingMenuId === m.id ? "-rotate-1 scale-[0.985] ring-2 ring-forest-300 opacity-80 shadow-xl" : ""}`}
                  style={{ touchAction: "pan-y" }}
                >
                  <div className="relative h-52 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,#edf2ed_0%,#f7f9f7_100%)] text-gray-300">
                        <ChefHat className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
                    {isOnPlate && (
                      <span className="absolute right-3 top-3 rounded-full bg-forest-600 px-3 py-1 text-[10px] font-bold text-white shadow-sm">
                        Di Piringku
                      </span>
                    )}
                    <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                      <span
                        className={`table-chip ${getKelompokBadgeClass(m.kategori)}`}
                      >
                        {m.kategori}
                      </span>
                      <span
                        className={`table-chip ${getPorsiBadgeClass(menuPorsi)}`}
                      >
                        {getPorsiLabel(menuPorsi)}
                      </span>
                      <span
                        className={`table-chip ${getTypeBadgeClass(menuType)}`}
                      >
                        {menuType === "minuman" ? "Minuman" : "Makanan"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold text-ink-700">
                          {displayName}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-2 text-[13px] text-ink-400">
                          <CalorieIcon className="h-3 w-3 text-orange-600" />{" "}
                          {m.kalori ?? 0} kkal per porsi
                        </p>
                      </div>

                      <MiniDonut
                        protein={protein}
                        karbo={karbo}
                        lemak={lemak}
                        size={42}
                      />
                    </div>

                    <div className="surface-muted rounded-[20px] px-4 py-3 text-[12px] font-semibold text-ink-400">
                      Seret card ini ke slot mingguan.
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        {
                          label: "Protein",
                          short: "P",
                          value: protein,
                          color: "#2e7d32",
                        },
                        {
                          label: "Karbo",
                          short: "K",
                          value: karbo,
                          color: "#60a5fa",
                        },
                        {
                          label: "Lemak",
                          short: "L",
                          value: lemak,
                          color: "#f59e0b",
                        },
                      ].map((n) => (
                        <div
                          key={n.label}
                          className="rounded-[20px] border border-ink-100 bg-white p-3 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between text-[11px] text-ink-400">
                            <span className="font-bold text-ink-500">
                              {n.short}
                            </span>
                            <span>{n.value}g</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (n.value / 50) * 100)}%`,
                                backgroundColor: n.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-right">
          <button
            onClick={() => onNavigate("menu-catalog")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900"
          >
            Lihat Semua <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {!isWeeklyOnly && showPlateMenuModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex h-[min(90vh,780px)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                    Pilih Menu Piringku
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-gray-800">
                    Tambahkan Menu
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    Cari menu, lihat ringkas nutrisi, lalu pilih untuk Piringku.
                  </p>
                </div>
                <button
                  onClick={() => setShowPlateMenuModal(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-forest-50 hover:text-forest-800"
                  title="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={plateMenuSearch}
                    onChange={(e) => setPlateMenuSearch(e.target.value)}
                    placeholder="Cari nama menu atau kategori"
                    className="w-full py-3 pl-11 pr-4 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-[18px] border border-ink-100 bg-forest-50/70 p-1">
                  <ListFilter className="ml-2 h-4 w-4 text-forest-800" />
                  {[
                    { key: "all", label: "Semua" },
                    { key: "target", label: STANDAR[kelompok].label },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setPlateTargetFilter(item.key as "all" | "target")
                      }
                      data-active={plateTargetFilter === item.key}
                      className="rounded-[14px] px-3 py-2 text-xs font-bold text-forest-700 transition data-[active=true]:bg-white data-[active=true]:text-forest-950 data-[active=true]:shadow-sm"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {plateMenuOptions.length === 0 ? (
                <div className="grid min-h-72 place-items-center rounded-[24px] border border-dashed border-forest-200 bg-forest-50/60 p-6 text-center">
                  <div>
                    <ChefHat className="mx-auto h-10 w-10 text-forest-800" />
                    <p className="mt-3 text-sm font-bold text-ink-700">
                      Menu tidak ditemukan
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-400">
                      Ubah kata kunci atau filter target.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                  {plateMenuOptions.map((menu) => {
                    const imageUrl = resolveMenuImageUrl(menu.gambar_url);
                    const displayName =
                      sanitizeMenuName(menu.nama) || menu.nama;
                    const isSelected = selectedMenuId === menu.id;

                    return (
                      <button
                        key={menu.id}
                        onClick={() => {
                          setSelectedMenuId(menu.id);
                          setShowPlateMenuModal(false);
                        }}
                        className={`min-h-[310px] overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md ${
                          isSelected
                            ? "border-forest-400 ring-2 ring-forest-100"
                            : "border-gray-100"
                        }`}
                      >
                        <div className="relative h-36 overflow-hidden">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
                              <ChefHat className="h-9 w-9" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />
                          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-forest-800">
                            {menu.kategori}
                          </span>
                        </div>
                        <div className="p-4">
                          <p className="truncate text-sm font-bold text-gray-800">
                            {displayName}
                          </p>
                          <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500">
                            {menu.deskripsi ||
                              "Komposisi menu MBG siap dianalisis."}
                          </p>
                          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                            {[
                              {
                                label: "Kal",
                                value: menu.kalori ?? 0,
                                unit: "kkal",
                              },
                              {
                                label: "Pro",
                                value: menu.protein ?? 0,
                                unit: "g",
                              },
                              {
                                label: "Lem",
                                value: menu.lemak ?? 0,
                                unit: "g",
                              },
                              {
                                label: "Kar",
                                value: menu.karbohidrat ?? 0,
                                unit: "g",
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="rounded-2xl bg-forest-50 px-2 py-2 text-center"
                              >
                                <p className="font-bold text-forest-800">
                                  {item.value}
                                </p>
                                <p className="mt-0.5 text-[9px] text-gray-500">
                                  {item.label} {item.unit}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isWeeklyOnly && showDistributionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-4xl rounded-[28px] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                  Lokasi Distribusi
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-800">
                  Pilih Lokasi Jadwal
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Klik lokasi untuk mengubah konteks Widget Mingguan tanpa
                  berpindah halaman.
                </p>
              </div>
              <button
                onClick={() => setShowDistributionModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-forest-50 hover:text-forest-800"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-forest-100 bg-forest-50/70 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                  Lokasi
                </p>
                <p className="mt-1 text-lg font-black text-forest-900">
                  {distributionLocations.length}
                </p>
              </div>
              <div className="rounded-[20px] border border-forest-100 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                  Sekolah
                </p>
                <p className="mt-1 text-lg font-black text-forest-900">
                  {
                    distributionLocations.filter(
                      (location) => location.type === "sekolah",
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-[20px] border border-forest-100 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                  Posyandu
                </p>
                <p className="mt-1 text-lg font-black text-forest-900">
                  {
                    distributionLocations.filter(
                      (location) => location.type === "posyandu",
                    ).length
                  }
                </p>
              </div>
            </div>

            {distributionLocations.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-forest-100 bg-forest-50/50 px-6 text-center">
                <div className="max-w-md">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-forest-800 shadow-sm">
                    <CalendarDays className="h-7 w-7" />
                  </div>
                  <h4 className="mt-4 text-lg font-bold text-gray-800">
                    Belum ada lokasi yang ditetapkan
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Tambahkan lokasi distribusi terlebih dahulu agar widget dan
                    jadwal mingguan bisa dipakai.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid max-h-[58vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {distributionLocations.map((location) => {
                  const isSelected = location.id === activeLocationId;

                  return (
                    <div
                      key={location.id}
                      onClick={() => selectDistributionLocation(location.id)}
                      className={`cursor-pointer overflow-hidden rounded-[22px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md ${
                        isSelected
                          ? "border-forest-400 ring-2 ring-forest-100"
                          : "border-gray-100"
                      }`}
                    >
                      <div className="relative h-28 overflow-hidden bg-[linear-gradient(180deg,#edf2ed_0%,#f7f9f7_100%)]">
                        {location.image ? (
                          <img
                            src={location.image}
                            alt={location.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <ChefHat className="h-10 w-10" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black/35 via-black/5 to-transparent" />
                        <div className="absolute bottom-2 left-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-forest-800">
                            {location.type === "sekolah"
                              ? "Sekolah"
                              : "Posyandu"}
                          </span>
                          <span className="rounded-full bg-forest-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            {getLocationRecipientLabel(location)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 p-4">
                        <div>
                          <p className="truncate text-sm font-bold text-gray-800">
                            {location.name}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-forest-100 bg-forest-50/70 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                            Catatan
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-600">
                            {location.note}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {isWeeklyOnly && showSchedulePeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[92vh] w-full max-w-[1380px] flex-col overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_32px_90px_rgba(12,24,16,0.28)]">
            <div className="border-b border-gray-100 px-5 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-800 shadow-inner">
                    <CalendarDays className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-2xl font-black text-gray-900">
                      Periode Menu Mingguan
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      Pilih dan kelola jadwal menu berdasarkan periode mingguan
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSchedulePeriodModal(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-forest-50 hover:text-forest-900"
                  title="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => shiftScheduleMonth(-1)}
                    className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:bg-forest-50"
                    title="Bulan sebelumnya"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <select
                    value={getMonthKey(dateFromKey(weeklyPeriodAnchor))}
                    onChange={(event) => {
                      const selected = schedulePeriodMonthOptions.find(
                        (option) => option.key === event.target.value,
                      );
                      if (selected) setWeeklyPeriodAnchor(selected.value);
                    }}
                    className="min-h-12 min-w-[230px] rounded-[18px] border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 shadow-sm"
                  >
                    {schedulePeriodMonthOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => shiftScheduleMonth(1)}
                    className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:bg-forest-50"
                    title="Bulan berikutnya"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 sm:w-64">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={periodSearch}
                      onChange={(event) => setPeriodSearch(event.target.value)}
                      placeholder="Cari minggu..."
                      className="h-12 w-full rounded-[18px] border-gray-200 bg-white pl-11 pr-4 text-sm shadow-sm"
                    />
                  </div>
                  <div className="relative sm:w-48">
                    <ListFilter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <select
                      value={periodStatusFilter}
                      onChange={(event) =>
                        setPeriodStatusFilter(
                          event.target.value as "all" | SchedulePeriodStatus,
                        )
                      }
                      className="h-12 w-full rounded-[18px] border-gray-200 bg-white pl-11 pr-4 text-sm font-bold text-gray-800 shadow-sm"
                    >
                      <option value="all">Filter Status</option>
                      <option value="complete">Jadwal Lengkap</option>
                      <option value="partial">Sebagian Terisi</option>
                      <option value="empty">Belum Ada Jadwal</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="-mx-1 mb-7 overflow-x-auto px-1 pb-2">
                <div className="flex min-w-max gap-3">
                  {visibleSchedulePeriods.map((period) => {
                    const isActive =
                      activeSchedulePeriod.startKey === period.startKey;
                    const isComplete = period.status === "complete";
                    const isPartial = period.status === "partial";
                    const progressColor = isComplete
                      ? "bg-forest-700"
                      : isPartial
                        ? "bg-amber-500"
                        : "bg-gray-300";
                    const cardTone = isComplete
                      ? "border-forest-100 bg-forest-50/45"
                      : isPartial
                        ? "border-amber-100 bg-amber-50/45"
                        : "border-dashed border-gray-200 bg-gray-50/75";

                    return (
                      <button
                        key={period.startKey}
                        onClick={() => setWeeklyPeriodAnchor(period.startKey)}
                        className={`min-h-[188px] w-[190px] rounded-[24px] border p-4 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
                          isActive
                            ? "scale-[1.03] border-2 border-forest-500 bg-white shadow-[0_22px_46px_rgba(46,125,50,0.18)] ring-4 ring-forest-100/80"
                            : cardTone
                        }`}
                      >
                        <div className="text-center">
                          <p className="text-base font-black text-gray-900">
                            {period.title}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            {period.rangeLabel}
                          </p>
                        </div>
                        <div
                          className={`mx-auto mt-6 flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                            isComplete
                              ? "bg-forest-50 text-forest-800"
                              : isPartial
                                ? "bg-amber-50 text-amber-700"
                                : "bg-white text-gray-500"
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isPartial ? (
                            <AlertTriangle className="h-4 w-4" />
                          ) : (
                            <CalendarDays className="h-4 w-4" />
                          )}
                          {period.statusLabel}
                        </div>
                        <div className="mt-6 flex items-center gap-3">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200/80">
                            <div
                              className={`h-full rounded-full ${progressColor}`}
                              style={{ width: `${period.completionPercent}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs font-black text-gray-800">
                            {period.filledDayCount}/6
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
                <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_18px_45px_rgba(36,49,39,0.08)]">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="text-xl font-black text-gray-900">
                          Ringkasan {activeSchedulePeriod.title}
                        </h4>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            activeSchedulePeriod.status === "complete"
                              ? "bg-forest-50 text-forest-800"
                              : activeSchedulePeriod.status === "partial"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {activeSchedulePeriod.status === "complete"
                            ? "Lengkap"
                            : activeSchedulePeriod.status === "partial"
                              ? "Sebagian Terisi"
                              : "Belum Ada Jadwal"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-500">
                        {activeSchedulePeriod.fullRangeLabel} •{" "}
                        {activeLocation.name}
                      </p>
                    </div>
                    <span className="rounded-full border border-forest-100 bg-forest-50 px-4 py-2 text-xs font-bold text-forest-800">
                      Senin - Sabtu
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        icon: CalendarDays,
                        value: `${activeSchedulePeriod.filledDayCount}/6`,
                        label: "Hari Terjadwal",
                        note: `${activeSchedulePeriod.completionPercent}% kesiapan`,
                        tone: "bg-forest-50 text-forest-800",
                      },
                      {
                        icon: UtensilsCrossed,
                        value: activeSchedulePeriod.uniqueMenuCount,
                        label: "Menu Digunakan",
                        note: `${activeSchedulePeriod.menuCount} slot menu`,
                        tone: "bg-sky-50 text-sky-700",
                      },
                      {
                        icon: Gauge,
                        value: `${activeSchedulePeriod.akgCompliance}%`,
                        label: "Kepatuhan AKG",
                        note: "Rata-rata minggu ini",
                        tone: "bg-violet-50 text-violet-700",
                      },
                      {
                        icon: Leaf,
                        value: activeSchedulePeriod.foodWasteRisk,
                        label: "Risiko Sisa Makanan",
                        note: "Kategori risiko",
                        tone: "bg-emerald-50 text-emerald-700",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="min-h-[140px] rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm"
                        >
                          <div
                            className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${item.tone}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="text-2xl font-black text-gray-900">
                            {item.value}
                          </p>
                          <p className="mt-1 text-sm font-bold text-gray-700">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {item.note}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6">
                    <h5 className="mb-3 text-sm font-black text-gray-900">
                      Distribusi Hari
                    </h5>
                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                      {activeSchedulePeriod.days.map((day) => {
                        const ids = getDayMenuIds(
                          normalizeDayPlan(weeklyPlan[day.dateKey]),
                        );
                        const isFilled = ids.length > 0;
                        const isMissing =
                          !isFilled &&
                          activeSchedulePeriod.status === "partial";
                        return (
                          <div
                            key={day.dateKey}
                            className={`rounded-[18px] border px-3 py-3 text-center ${
                              isFilled
                                ? "border-forest-100 bg-forest-50 text-forest-800"
                                : isMissing
                                  ? "border-amber-100 bg-amber-50 text-amber-700"
                                  : "border-gray-100 bg-gray-50 text-gray-500"
                            }`}
                          >
                            <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80">
                              {isFilled ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : isMissing ? (
                                <AlertTriangle className="h-4 w-4" />
                              ) : (
                                <Clock3 className="h-4 w-4" />
                              )}
                            </div>
                            <p className="text-xs font-black">
                              {day.dayLabel.slice(0, 3)}
                            </p>
                            <p className="mt-1 text-xs font-bold">
                              {isFilled
                                ? "Terisi"
                                : isMissing
                                  ? "Belum"
                                  : "Kosong"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-5 text-xs font-semibold text-gray-600">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-forest-600" />
                        Terisi
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-amber-400" />
                        Sebagian / Belum
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-gray-300" />
                        Kosong
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="night-panel-accent rounded-[28px] border border-forest-100 bg-linear-to-br from-forest-50 via-emerald-50 to-white p-5 shadow-[0_18px_45px_rgba(46,125,50,0.10)]">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-forest-800 shadow-sm">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <h4 className="text-base font-black text-forest-950">
                        Insight AI
                      </h4>
                    </div>
                    <ul className="space-y-2 text-sm leading-6 text-gray-700">
                      <li>
                        {activeSchedulePeriod.missingLabels.length} hari belum
                        memiliki menu
                      </li>
                      <li>
                        Kepatuhan AKG minggu ini berada di{" "}
                        {activeSchedulePeriod.akgCompliance}%
                      </li>
                      <li>
                        Distribusi menu{" "}
                        {activeSchedulePeriod.status === "complete"
                          ? "sudah merata"
                          : "belum merata"}
                      </li>
                      <li>
                        Disarankan menjaga konsistensi protein hewani di hari
                        operasional
                      </li>
                    </ul>
                    <button className="mt-5 inline-flex items-center gap-2 rounded-[16px] border border-forest-100 bg-white px-4 py-3 text-sm font-black text-forest-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      Lihat Rekomendasi <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                        <Info className="h-5 w-5" />
                      </div>
                      <h4 className="text-base font-black text-gray-900">
                        Catatan
                      </h4>
                    </div>
                    <p className="text-sm leading-6 text-gray-600">
                      Pastikan seluruh hari memiliki menu untuk menjaga
                      konsistensi distribusi bahan baku dan pemenuhan gizi.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-xs font-semibold text-gray-500">
                Periode aktif: {activeSchedulePeriod.fullRangeLabel}
              </p>
              <div className="flex gap-3 sm:justify-end">
                <button
                  onClick={() => setShowSchedulePeriodModal(false)}
                  className="btn-secondary min-w-32"
                >
                  Batal
                </button>
                <button
                  onClick={() => setShowSchedulePeriodModal(false)}
                  className="btn-primary min-w-44"
                >
                  Pilih Minggu Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isWeeklyOnly && showSaveScheduleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-forest-50 text-forest-800">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Simpan Jadwal?
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Apakah Anda yakin ingin menyimpan jadwal untuk lokasi ini?
                </p>
              </div>
            </div>

            <div className="rounded-[18px] border border-forest-100 bg-forest-50/70 px-4 py-3">
              <p className="text-xs font-semibold text-forest-800">
                {activeLocation.name} • {activeLocationRecipients}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowSaveScheduleConfirm(false)}
                className="btn-secondary flex-1 px-3 py-3 text-sm"
              >
                Batal
              </button>
              <button
                onClick={confirmSaveWeeklySchedule}
                className="flex-1 rounded-[18px] bg-forest-800 px-3 py-3 text-sm font-semibold text-white transition hover:bg-forest-900"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
