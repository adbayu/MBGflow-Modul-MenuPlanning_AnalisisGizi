import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  FlaskConical,
  Gauge,
  HeartPulse,
  Info,
  Leaf,
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
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";
const HOLIDAY_API = "https://libur.deno.dev/api";
const WEEKLY_PLAN_STORAGE_KEY = "mbg_weekly_plan_v1";
const WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY = "mbg_weekly_plan_by_location_v1";
const SAVED_WEEKLY_LOCATION_STORAGE_KEY = "mbg_saved_weekly_location_v1";

type Kelompok =
  | "siswa"
  | "balita"
  | "ibu_hamil"
  | "ibu_menyusui"
  | "lansia";
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
  return name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function toShortLabel(name: string) {
  const compact = name.trim();
  if (!compact) return "Nt";
  const words = compact.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }
  return compact.slice(0, 2).toUpperCase();
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
  const dayLabels = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const jsDay = today.getDay();
  const daysFromMonday = jsDay === 0 ? 6 : jsDay - 1;

  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return dayLabels.map((label, idx) => {
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
function getPorsiBadgeClass(porsi: MenuPorsi) {
  return porsi === "porsi_besar"
    ? "bg-orange-100 text-orange-700"
    : "bg-sky-100 text-sky-700";
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
          const length = total > 0 ? (segment.value / total) * circumference : 0;
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

const DISTRIBUTION_LOCATIONS = [
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

function getLocationRecipientLabel(
  location: (typeof DISTRIBUTION_LOCATIONS)[number],
) {
  return location.recipients.map((recipient) => recipient.label).join(" & ");
}

function getLocationTargetLabel(
  location: (typeof DISTRIBUTION_LOCATIONS)[number],
) {
  return location.recipients.map((recipient) => recipient.target).join(" + ");
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [kelompok, setKelompok] = useState<Kelompok>("siswa");
  const [search, setSearch] = useState("");
  const [plateMenuSearch, setPlateMenuSearch] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [plateMenuIds, setPlateMenuIds] = useState<number[]>([]);
  const [activeLocationId, setActiveLocationId] = useState(
    DISTRIBUTION_LOCATIONS[0].id,
  );
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
  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});

  const openDistributionModal = () => {
    setShowDistributionModal(true);
  };

  const activeLocation =
    DISTRIBUTION_LOCATIONS.find(
      (location) => location.id === activeLocationId,
    ) || DISTRIBUTION_LOCATIONS[0];
  const weeklyPlan = weeklyPlanByLocation[activeLocationId] || {};
  const activeLocationRecipients = getLocationRecipientLabel(activeLocation);
  const activeLocationTargets = getLocationTargetLabel(activeLocation);

  useEffect(() => {
    Promise.all([
      fetch(API).then((r) => r.json()),
      fetch(`${API}/stats/summary`).then((r) => r.json()),
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
          setPlateMenuIds([list[0].id]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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
    try {
      const savedByLocation = localStorage.getItem(
        WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY,
      );
      const savedStatus = localStorage.getItem(
        SAVED_WEEKLY_LOCATION_STORAGE_KEY,
      );

      if (savedStatus) {
        const parsedStatus = JSON.parse(savedStatus);
        if (parsedStatus && typeof parsedStatus === "object") {
          setSavedScheduleMap(parsedStatus as SavedScheduleMap);
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
          setWeeklyPlanByLocation(normalizedByLocation);
          return;
        }
      }

      const saved = localStorage.getItem(WEEKLY_PLAN_STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        const normalized: WeeklyPlan = {};
        Object.entries(parsed).forEach(([dateKey, day]) => {
          normalized[dateKey] = normalizeDayPlan(day);
        });
        setWeeklyPlanByLocation({
          [DISTRIBUTION_LOCATIONS[0].id]: normalized,
        });
      }
    } catch (error) {
      console.error("Gagal memuat jadwal mingguan:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      WEEKLY_PLAN_BY_LOCATION_STORAGE_KEY,
      JSON.stringify(weeklyPlanByLocation),
    );
  }, [weeklyPlanByLocation]);

  useEffect(() => {
    localStorage.setItem(
      SAVED_WEEKLY_LOCATION_STORAGE_KEY,
      JSON.stringify(savedScheduleMap),
    );
  }, [savedScheduleMap]);

  const weekDays = useMemo(() => getCurrentWeekDays(new Date()), []);
  const weekPeriod =
    weekDays.length > 0
      ? `${weekDays[0].dateLabel} - ${weekDays[weekDays.length - 1].dateLabel}`
      : "";
  const menuLookup = useMemo(
    () => new Map(menus.map((menu) => [menu.id, menu])),
    [menus],
  );

  const resolvedMenuPorsi = useMemo(() => {
    const result: Record<number, MenuPorsi> = {};
    menus.forEach((menu) => {
      result[menu.id] =
        menuMetaMap[menu.id]?.porsi || inferMenuPorsi(menu.kalori);
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

  useEffect(() => {
    if (plateMenuIds.length === 0) {
      setPlateAiAnalysis(null);
      setPlateAiError(null);
      setPlateAiLoading(false);
      return;
    }

    const controller = new AbortController();
    setPlateAiLoading(true);
    setPlateAiError(null);

    fetch(`${API}/analyze-plate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menuIds: plateMenuIds,
        target: STANDAR[kelompok].label,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Analisis AI gagal");
        setPlateAiAnalysis(data as AIAnalysisResult);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPlateAiError(
          err instanceof Error ? err.message : "Analisis AI gagal diproses",
        );
        setPlateAiAnalysis(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlateAiLoading(false);
      });

    return () => controller.abort();
  }, [kelompok, plateMenuIds]);

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
        abbr: string;
        label: string;
        unit: string;
        color: string;
        value: number;
        percent: number;
        statusLabel: string;
        statusClass: string;
      }
    > = {};

    let paletteIndex = 0;

    piringkuMenus.forEach((menu) => {
      const manualList =
        plateManualMacrosMap[menu.id] || menu.manual_macronutrients || [];

      manualList.forEach((macro) => {
        const normalized = normalizeNutrientName(macro.nama || "");
        if (!normalized) return;

        const numericValue = Number(macro.nilai || 0);
        if (!Number.isFinite(numericValue)) return;

        if (!dynamicMap[normalized]) {
          const color =
            MANUAL_NUTRIENT_COLORS[
              paletteIndex % MANUAL_NUTRIENT_COLORS.length
            ];
          paletteIndex += 1;

          dynamicMap[normalized] = {
            key: `manual-${normalized.replace(/\s+/g, "-")}`,
            abbr: toShortLabel(macro.nama || "Nutrien"),
            label: macro.nama || "Nutrien Tambahan",
            unit: macro.satuan || "g",
            color,
            value: 0,
            percent: 0,
            statusLabel: "Baik",
            statusClass: "text-emerald-600",
          };
        }

        dynamicMap[normalized].value += numericValue;
      });
    });

    const dynamicFields = Object.values(dynamicMap);
    const maxValue = dynamicFields.reduce(
      (max, item) => Math.max(max, item.value),
      0,
    );

    return dynamicFields.map((item) => {
      if (item.value <= 0 || maxValue <= 0) {
        return {
          ...item,
          percent: 0,
          statusLabel: "Kurang",
          statusClass: "text-emerald-400",
        };
      }

      const ratio = item.value / maxValue;
      if (ratio >= 0.8) {
        return {
          ...item,
          percent: Math.round(ratio * 100),
          statusLabel: "Baik",
          statusClass: "text-emerald-600",
        };
      }

      if (ratio >= 0.5) {
        return {
          ...item,
          percent: Math.round(ratio * 100),
          statusLabel: "Cukup",
          statusClass: "text-emerald-600",
        };
      }

      return {
        ...item,
        percent: Math.round(ratio * 100),
        statusLabel: "Kurang",
        statusClass: "text-emerald-400",
      };
    });
  }, [piringkuMenus, plateManualMacrosMap]);

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
    const percent = row.target > 0 ? Math.round((row.val / row.target) * 100) : 0;
    return {
      ...row,
      percent,
      status: getAkgStatus(percent),
    };
  });

  const visibleRows = rows.filter((row) => row.val > 0);
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

  const aiWarnings =
    plateAiAnalysis?.rekomendasi.filter((rec) => rec.severity !== "success") ||
    [];
  const aiSuccess =
    plateAiAnalysis?.rekomendasi.find((rec) => rec.severity === "success") ||
    null;
  const aiTips = aiWarnings.length > 0 ? aiWarnings : plateAiAnalysis?.rekomendasi || [];
  const retryPlateAi = () => setPlateMenuIds((prev) => [...prev]);

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
    if (!q) return menus;
    return menus.filter((menu) => {
      const cleanName = sanitizeMenuName(menu.nama).toLowerCase();
      return (
        cleanName.includes(q) ||
        menu.nama.toLowerCase().includes(q) ||
        menu.kategori.toLowerCase().includes(q)
      );
    });
  }, [menus, plateMenuSearch]);

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
    const locationCount = DISTRIBUTION_LOCATIONS.length;
    const savedLocationCount = Object.keys(savedScheduleMap).length;

    return [
      {
        title: "Total Menu",
        value: totalMenus,
        subtitle: "Seluruh menu tercatat",
        insight:
          totalMenus > 0
            ? "Basis variasi menu tersedia."
            : "Tambahkan menu pertama.",
        gradient: "from-forest-950 via-forest-900 to-forest-700",
        iconBg: "bg-white/10",
        icon: UtensilsCrossed,
        watermarkColor: "text-white/8",
      },
      {
        title: "Lokasi Distribusi",
        value: locationCount,
        subtitle: activeLocation.name,
        insight: `${activeLocationRecipients} - ${activeLocationTargets}`,
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: Users,
        watermarkColor: "text-forest-100",
      },
      {
        title: "Jadwal Tersimpan",
        value: `${savedLocationCount}/${locationCount}`,
        subtitle: "Lokasi sudah dijadwalkan",
        insight: activeLocationSaved
          ? "Lokasi aktif sudah tersimpan."
          : "Lokasi aktif belum disimpan.",
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: CheckCircle2,
        watermarkColor: "text-forest-100",
      },
      {
        title: "Kategori MBG",
        value: "5",
        subtitle: "Siswa, Balita, Ibu Hamil",
        insight: "Segmentasi porsi tetap terjaga.",
        gradient: "from-[#ffffff] to-[#f7faf7]",
        iconBg: "bg-forest-100",
        icon: Users,
        watermarkColor: "text-forest-100",
      },
    ];
  }, [
    activeLocation.name,
    activeLocationRecipients,
    activeLocationSaved,
    activeLocationTargets,
    savedScheduleMap,
    stats,
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
    const ghost = source.cloneNode(true) as HTMLDivElement;
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.width = `${rect.width}px`;
    ghost.style.maxWidth = `${rect.width}px`;
    ghost.style.opacity = "0.9";
    ghost.style.transform = "rotate(-2deg) scale(0.98)";
    ghost.style.borderRadius = "14px";
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
      <div className="page-header">
        <div>
          <span className="soft-badge">Operations Overview</span>
          <h1 className="page-title mt-4">Dashboard MBG</h1>
          <p className="page-subtitle">
            Pantau menu, evaluasi nutrisi, dan susun jadwal mingguan dalam satu
            workspace yang lebih lega dan fokus.
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryWidgets.map((widget, idx) => {
          const Icon = widget.icon;
          const isPrimary = idx === 0;
          return (
            <motion.div
              key={widget.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`relative cursor-default overflow-hidden rounded-[30px] border p-6 transition-all hover:-translate-y-1 ${
                isPrimary
                  ? `bg-linear-to-br ${widget.gradient} border-white/10 text-white shadow-[0_24px_54px_rgba(23,59,35,0.22)]`
                  : `bg-linear-to-br ${widget.gradient} border-ink-100 text-ink-700 shadow-[0_16px_36px_rgba(36,49,39,0.07)]`
              }`}
            >
              <Icon
                className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${widget.watermarkColor}`}
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
                <p className="mb-1 text-3xl font-black leading-tight">
                  {widget.value}
                </p>
                <p
                  className={`text-sm font-medium leading-5 ${
                    isPrimary ? "text-white/60" : "text-ink-400"
                  }`}
                >
                  {widget.subtitle}
                </p>
                <p
                  className={`mt-3 border-t pt-3 text-xs font-semibold leading-5 ${
                    isPrimary
                      ? "border-white/10 text-white/72"
                      : "border-forest-100 text-forest-800"
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
          <div className="bg-[linear-gradient(135deg,#ffffff_0%,#f7fbf7_55%,#eef8ef_100%)] p-4 sm:p-6">
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
              <div className="rounded-[24px] border border-forest-100 bg-white/90 px-4 py-3 shadow-sm">
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
                    <span className="truncate">{STANDAR[tab.key].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
              <button
                onClick={() => setShowPlateMenuModal(true)}
                className="flex min-h-14 items-center justify-between gap-3 rounded-[22px] border border-ink-100 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition hover:border-forest-200 hover:bg-forest-50"
              >
                <span className="min-w-0 truncate font-semibold">
                  {selectedMenuId
                    ? sanitizeMenuName(
                        menuLookup.get(selectedMenuId)?.nama || "Pilih menu",
                      )
                    : "Cari menu untuk mulai analisis piringku"}
                </span>
                <Search className="h-4 w-4 shrink-0 text-forest-700" />
              </button>
              <button
                onClick={() => selectedMenuId && addMenu(selectedMenuId)}
                disabled={!selectedMenuId || plateAiLoading}
                className="btn-primary inline-flex min-h-14 items-center justify-center gap-2 px-6 text-sm disabled:opacity-50"
              >
                {plateAiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Tambah ke Piringku
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
                      Pilih menu untuk mulai analisis piringku
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-ink-400">
                      Belum ada data nutrisi untuk ditampilkan. Tambahkan menu
                      atau seret kartu dari daftar bawah.
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
                          className="grid overflow-hidden rounded-[28px] border border-ink-100 bg-white shadow-sm sm:grid-cols-[180px_1fr]"
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
                            <div className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-bold text-forest-900 shadow-sm">
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
                                [`${Math.round(Number(menu.kalori || 0))}`, "kkal"],
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
                                        (slice.value / menuMacroTotal) * 100,
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
                                        style={{ backgroundColor: slice.color }}
                                      />
                                      <span className="truncate font-bold text-ink-700">
                                        {slice.label}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-ink-400">
                                      {Math.round(slice.value)} g - {percent}%
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
                        <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
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
                              pathLength: Math.min(1.3, plateAkgPercent / 100),
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
                                {Math.round(row.val)} / {row.target} {row.unit}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-ink-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbf7_100%)] p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                          Komposisi Makronutrien
                        </p>
                        <h3 className="mt-1 text-lg font-black text-ink-700">
                          Donut Macro Composition
                        </h3>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-forest-800 shadow-sm">
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
                              className="rounded-[22px] border border-ink-100 bg-white px-4 py-3 shadow-sm"
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
                                      {Math.round(slice.value)} g - {kcal} kkal
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

                    {visibleRows.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-ink-100 bg-gray-50 p-5 text-sm text-ink-400">
                        Belum ada data nutrisi untuk dibandingkan.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleRows.map((row) => (
                          <div
                            key={row.label}
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
                              {row.target} {row.unit}
                            </p>
                            <p className="text-sm font-black text-ink-700">
                              {row.percent}%
                            </p>
                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${row.status.badgeClass}`}
                            >
                              {row.status.label}
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
                          Tambahkan nutrien manual pada menu agar progres mikro
                          muncul di sini.
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
                            const percent =
                              microTotal > 0
                                ? Math.round((field.value / microTotal) * 100)
                                : 0;

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
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-black text-ink-700">
                                      {percent}%
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

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                  {plateAiLoading ? (
                    [0, 1, 2].map((item) => (
                      <div
                        key={item}
                        className="nutrition-shimmer h-44 rounded-[30px] border border-ink-100 bg-white"
                      />
                    ))
                  ) : plateAiError ? (
                    <div className="xl:col-span-3 rounded-[30px] border border-red-100 bg-red-50 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                          <div>
                            <p className="text-sm font-bold text-red-800">
                              Gemini API gagal memproses analisis
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
                              Gemini insight
                            </p>
                          </div>
                        </div>
                        <p className="text-sm leading-7 text-violet-950/80">
                          {aiWarnings[0]?.pesan ||
                            aiSuccess?.pesan ||
                            plateAiAnalysis.pesan}
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
                          {aiTips[0]?.detail || aiTips[0]?.pesan || plateAiAnalysis.pesan}
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
                          {plateAiAnalysis.pesan}
                        </p>
                      </div>
                    </>
                  ) : null}
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

      <div className="card rounded-[32px] p-5 sm:p-6">
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
                Jadwal aktif untuk{" "}
                <span className="font-semibold text-forest-800">
                  {activeLocation.name}
                </span>{" "}
                ({activeLocationRecipients}).
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
                onClick={() => setShowSaveScheduleConfirm(true)}
                className="inline-flex items-center gap-1 rounded-full border border-forest-700 bg-forest-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-forest-900"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Simpan Jadwal Mingguan
              </button>
            </div>
          </div>

          <div className="mb-5 overflow-hidden rounded-[26px] border border-forest-100 bg-white shadow-sm">
            <div className="relative min-h-[150px] p-5">
              <div className="relative z-10 max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                  Lokasi Distribusi
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-forest-100 bg-forest-50 text-forest-800 shadow-sm">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xl font-bold text-gray-800">
                      {activeLocation.name}
                    </h4>
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
                      <p className="text-xs text-gray-400">{day.dateLabel}</p>
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
                      className={`min-h-[176px] rounded-[20px] border border-emerald-200 bg-emerald-50/40 px-2.5 py-2.5 transition-all ${
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
                                className="rounded-[14px] border border-gray-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md"
                              >
                                <div className="mb-1 flex items-center gap-1.5">
                                  {thumbUrl ? (
                                    <img
                                      src={thumbUrl}
                                      alt={displayName}
                                      className="h-6 w-6 rounded object-cover"
                                    />
                                  ) : (
                                    <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-400">
                                      <ChefHat className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                  <p className="truncate text-[10px] font-semibold text-gray-700">
                                    {displayName}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-semibold text-gray-400">
                                    {menu.kalori ?? 0} kkal
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeMenuFromDay(day.dateKey, menu.id);
                                    }}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    title="Hapus dari jadwal"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-3">
            {filtered.map((m) => {
              const protein = Number(m.protein || 0);
              const karbo = Number(m.karbohidrat || 0);
              const lemak = Number(m.lemak || 0);
              const isOnPlate = plateMenuIds.includes(m.id);
              const imageUrl = resolveMenuImageUrl(m.gambar_url);
              const menuPorsi =
                resolvedMenuPorsi[m.id] || inferMenuPorsi(m.kalori);
              const displayName = sanitizeMenuName(m.nama) || m.nama;

              return (
                <motion.div
                  key={m.id}
                  whileHover={{ y: -3 }}
                  draggable
                  onDragStartCapture={(e) =>
                    handleCardDragStart(e as DragEvent<HTMLDivElement>, m.id)
                  }
                  onDragEnd={handleCardDragEnd}
                  className={`touch-pan-y cursor-grab overflow-hidden rounded-[24px] border bg-white transition-all active:cursor-grabbing ${
                    isOnPlate
                      ? "border-forest-400 shadow-md shadow-forest-100"
                      : "border-gray-200 hover:shadow-md"
                  } ${draggingMenuId === m.id ? "-rotate-1 scale-[0.985] ring-2 ring-forest-300 opacity-80 shadow-xl" : ""}`}
                  style={{ touchAction: "pan-y" }}
                >
                  <div className="relative h-28 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-gray-100 to-gray-50 text-gray-300">
                        <ChefHat className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/35 to-transparent" />
                    {isOnPlate && (
                      <span className="absolute right-2 top-2 rounded-full bg-forest-600 px-2 py-0.5 text-[9px] font-bold text-white">
                        Di Piringku
                      </span>
                    )}
                    <div className="absolute bottom-2 left-3 flex gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getPorsiBadgeClass(menuPorsi)}`}
                      >
                        {getPorsiLabel(menuPorsi)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-800">
                          {displayName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500 inline-flex items-center gap-2">
                          Kategori {m.kategori} ·{" "}
                          <CalorieIcon className="h-3 w-3 text-orange-600" />{" "}
                          {m.kalori ?? 0} kkal
                        </p>
                      </div>

                      <MiniDonut
                        protein={protein}
                        karbo={karbo}
                        lemak={lemak}
                        size={34}
                      />
                    </div>

                    <div className="mt-2 flex gap-1">
                      {[
                        { label: "P", value: protein, color: "#10b981" },
                        { label: "K", value: karbo, color: "#8b5cf6" },
                        { label: "L", value: lemak, color: "#f59e0b" },
                      ].map((n) => (
                        <div key={n.label} className="flex-1">
                          <div className="mb-0.5 flex justify-between text-[8px] text-gray-400">
                            <span>{n.label}</span>
                            <span>{n.value}g</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-gray-100">
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

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium text-gray-400">
                        Seret card ini ke slot mingguan.
                      </p>
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

      {showPlateMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
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
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={plateMenuSearch}
                  onChange={(e) => setPlateMenuSearch(e.target.value)}
                  placeholder="Cari nama menu atau kategori"
                  className="w-full py-3 pl-11 pr-4 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
              {plateMenuOptions.map((menu) => {
                const imageUrl = resolveMenuImageUrl(menu.gambar_url);
                const displayName = sanitizeMenuName(menu.nama) || menu.nama;
                const isSelected = selectedMenuId === menu.id;

                return (
                  <button
                    key={menu.id}
                    onClick={() => {
                      setSelectedMenuId(menu.id);
                      setShowPlateMenuModal(false);
                    }}
                    className={`overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-md ${
                      isSelected
                        ? "border-forest-400 ring-2 ring-forest-100"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="relative h-32 overflow-hidden">
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
                      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                        {[
                          {
                            label: "Kal",
                            value: menu.kalori ?? 0,
                            unit: "kkal",
                          },
                          { label: "Pro", value: menu.protein ?? 0, unit: "g" },
                          { label: "Lem", value: menu.lemak ?? 0, unit: "g" },
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
          </div>
        </div>
      )}

      {showDistributionModal && (
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
                  {DISTRIBUTION_LOCATIONS.length}
                </p>
              </div>
              <div className="rounded-[20px] border border-forest-100 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-700/75">
                  Sekolah
                </p>
                <p className="mt-1 text-lg font-black text-forest-900">
                  {
                    DISTRIBUTION_LOCATIONS.filter(
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
                  Balita & Ibu Hamil
                </p>
              </div>
            </div>

            <div className="grid max-h-[58vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {DISTRIBUTION_LOCATIONS.map((location) => {
                const isSelected = location.id === activeLocationId;
                const isScheduled = Boolean(savedScheduleMap[location.id]);

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
                          {location.type === "sekolah" ? "Sekolah" : "Posyandu"}
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
                        <p className="mt-1 text-xs font-semibold text-forest-700">
                          {getLocationTargetLabel(location)} •{" "}
                          {location.schedule}
                        </p>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                          isScheduled
                            ? "border-forest-200 bg-forest-50 text-forest-800"
                            : "border-gray-200 bg-white text-gray-500"
                        }`}
                      >
                        {isScheduled ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock3 className="h-3 w-3" />
                        )}
                        {isScheduled
                          ? "Sudah dijadwalkan"
                          : "Belum dijadwalkan"}
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
          </div>
        </div>
      )}

      {showSaveScheduleConfirm && (
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
