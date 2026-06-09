import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  ChefHat,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import AIAnalysisPanel from "../components/AIAnalysisPanel";
import { CalorieIcon } from "../components/icons/NutrientIcons";
import type { Menu, PageView } from "../types";
import {
  clearEditTargetMenuId,
  getPorsiLabel,
  hasCachedAnalysis,
  inferMenuPorsi,
  inferMenuType,
  loadMenuMetaMap,
  resolveMenuPorsi,
  resolveMenuType,
  sanitizeMenuName,
  saveMenuMetaMap,
  setEditTargetMenuId,
  type MenuPorsi,
  type MenuType,
  type MenuMetaEntry,
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";

type TabKat =
  | "all"
  | "Siswa"
  | "Balita"
  | "Ibu Hamil"
  | "porsi_besar"
  | "porsi_kecil"
  | "makanan"
  | "minuman";

const tabs: Array<{ key: TabKat; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "Siswa", label: "Siswa" },
  { key: "Balita", label: "Balita" },
  { key: "Ibu Hamil", label: "Ibu Hamil" },
  { key: "porsi_besar", label: "Porsi Besar" },
  { key: "porsi_kecil", label: "Porsi Kecil" },
  { key: "makanan", label: "Makanan" },
  { key: "minuman", label: "Minuman" },
];

interface MenuCatalogPageProps {
  onNavigate: (p: PageView) => void;
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
        className="flex items-center justify-center rounded-full border border-ink-100 bg-white"
      >
        <span className="text-[8px] text-ink-400">N/A</span>
      </div>
    );
  }

  const slices = [
    { value: karbo, color: "#60a5fa", label: "Karbo" },
    { value: protein, color: "#2e7d32", label: "Protein" },
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

export default function MenuCatalogPage({ onNavigate }: MenuCatalogPageProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKat>("all");
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [, setAnalysisVersion] = useState(0);
  const [menuMetaMap, setMenuMetaMap] = useState<Record<number, MenuMetaEntry>>(
    {},
  );

  useEffect(() => {
    setLoading(true);
    fetch(API)
      .then((r) => r.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as Menu[]) : [];
        setMenus(list);

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
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return menus.filter((menu) => {
      const cleanName = sanitizeMenuName(menu.nama).toLowerCase();
      const rawName = menu.nama.toLowerCase();
      const q = search.toLowerCase();
      const bySearch = !q || cleanName.includes(q) || rawName.includes(q);

      const porsi = resolveMenuPorsi(menu, menuMetaMap);
      const type = resolveMenuType(menu, menuMetaMap);

      let byTab = true;
      if (tab === "porsi_besar" || tab === "porsi_kecil") {
        byTab = porsi === tab;
      } else if (tab === "makanan" || tab === "minuman") {
        byTab = type === tab;
      } else if (tab !== "all") {
        byTab = menu.kategori === tab;
      }

      return bySearch && byTab;
    });
  }, [menus, search, tab, menuMetaMap]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus menu");

      setMenus((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
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
          <span className="soft-badge">Data Catalog</span>
          <h1 className="page-title mt-4">Menu Catalog MBG</h1>
          <p className="page-subtitle">
            Katalog menu dengan status analisis AI tersimpan.
          </p>
        </div>
        <button
          onClick={() => {
            clearEditTargetMenuId();
            onNavigate("recipe-builder");
          }}
          className="btn-primary flex items-center gap-2 px-5 py-3"
        >
          <Plus className="h-4 w-4" /> Tambah Menu
        </button>
      </div>

      <div className="card rounded-[30px] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu berdasarkan nama atau kategori"
              className="w-full py-3 pl-11 pr-4 text-sm"
            />
          </div>

          <div className="surface-muted flex items-center gap-3 rounded-[22px] px-4 py-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                Total ditampilkan
              </p>
              <p className="mt-1 text-lg font-bold text-ink-700">
                {filtered.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pill-toggle flex flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-active={tab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card flex min-h-[240px] items-center justify-center rounded-[30px] p-8 text-sm text-ink-400">
          Memuat menu...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex min-h-[280px] items-center justify-center rounded-[30px] border border-dashed border-forest-100 bg-white p-8 text-center shadow-sm">
          <div className="max-w-md">
            <ChefHat className="mx-auto h-11 w-11 text-forest-800" />
            <h3 className="mt-4 text-lg font-bold text-ink-700">
              {menus.length === 0 ? "Belum Ada Menu" : "Menu tidak ditemukan"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-400">
              {menus.length === 0
                ? "Tambahkan menu terlebih dahulu agar katalog dapat menampilkan data."
                : "Ubah kata kunci pencarian atau filter kategori untuk menampilkan menu."}
            </p>
            {menus.length === 0 && (
              <button
                onClick={() => {
                  clearEditTargetMenuId();
                  onNavigate("recipe-builder");
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-[18px] bg-forest-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-900"
              >
                <Plus className="h-4 w-4" />
                Tambah Menu
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-2">
          {filtered.map((menu) => {
            const protein = Number(menu.protein || 0);
            const karbo = Number(menu.karbohidrat || 0);
            const lemak = Number(menu.lemak || 0);
            const imageUrl = resolveMenuImageUrl(menu.gambar_url);
            const menuType = resolveMenuType(menu, menuMetaMap);
            const menuPorsi = resolveMenuPorsi(menu, menuMetaMap);
            const hasAnalysis = hasCachedAnalysis(menu.id);
            const displayName = sanitizeMenuName(menu.nama);

            return (
              <motion.div
                key={menu.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="card card-hover overflow-hidden rounded-[30px] border border-forest-100/70 bg-white"
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

                  <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                    <span
                      className={`table-chip ${getKelompokBadgeClass(menu.kategori)}`}
                    >
                      {menu.kategori}
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-ink-700">
                        {displayName}
                      </h3>
                      <p className="mt-1 text-[13px] text-ink-400 inline-flex items-center gap-2">
                        <CalorieIcon className="h-3 w-3 text-orange-600" />{" "}
                        {menu.kalori ?? 0} kkal per porsi
                      </p>
                    </div>
                    <MiniDonut
                      protein={protein}
                      karbo={karbo}
                      lemak={lemak}
                      size={42}
                    />
                  </div>

                  <div className="surface-muted rounded-[20px] px-4 py-3 text-[12px] font-semibold">
                    {hasAnalysis ? (
                      <span className="text-emerald-700">
                        Analisis AI tersimpan
                      </span>
                    ) : (
                      <span className="text-ink-400">Belum dianalisis</span>
                    )}
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

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setAnalyzingId(analyzingId === menu.id ? null : menu.id)
                      }
                      className="btn-secondary flex flex-1 items-center justify-center gap-2 px-3 py-3 text-xs"
                    >
                      <Brain className="h-3.5 w-3.5" />
                      {hasAnalysis ? "Lihat Analisis" : "Analisis AI"}
                    </button>

                    <button
                      onClick={() => {
                        setEditTargetMenuId(menu.id);
                        onNavigate("recipe-builder");
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-emerald-100 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                      title="Edit menu"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setDeleteTarget(menu)}
                      className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-emerald-100 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* AI Analysis rendered as modal to keep grid tidy */}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-lg">
            <div className="mb-3 flex items-start gap-3">
              <div className="rounded-[18px] bg-emerald-50 p-3 text-emerald-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink-700">
                  Konfirmasi Hapus Menu
                </h3>
                <p className="text-sm leading-7 text-ink-400">
                  Menu{" "}
                  <span className="font-semibold text-ink-700">
                    {sanitizeMenuName(deleteTarget.nama)}
                  </span>{" "}
                  akan dihapus permanen.
                </p>
              </div>
            </div>

            <p className="rounded-[20px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-800">
              Tindakan ini tidak bisa dibatalkan. Pastikan menu yang dipilih
              sudah benar.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1 px-3 py-3 text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 rounded-[18px] bg-emerald-700 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Menu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {analyzingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                    AI Nutrient Insight
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-gray-800">
                    Analisis AI
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    Ringkasan singkat, detail nutrisi, dan rekomendasi tindakan.
                  </p>
                </div>
                <button
                  onClick={() => setAnalyzingId(null)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-500 transition hover:bg-forest-50 hover:text-forest-800"
                >
                  Tutup
                </button>
              </div>
            </div>
            <div className="overflow-y-auto">
              <AIAnalysisPanel
                menuId={analyzingId}
                menuNama={menus.find((m) => m.id === analyzingId)?.nama || ""}
                menuType={
                  (() => {
                    const activeMenu = menus.find((m) => m.id === analyzingId);
                    return activeMenu
                      ? resolveMenuType(activeMenu, menuMetaMap)
                      : undefined;
                  })()
                }
                onAnalysisSaved={() => setAnalysisVersion((v) => v + 1)}
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
