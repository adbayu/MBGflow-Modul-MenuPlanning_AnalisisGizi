import { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  Search,
  Trash2,
  Pencil,
  Brain,
  Eye,
  ChevronDown,
  Scale,
  Users,
} from "lucide-react";
import type { Menu } from "../types";
import AIAnalysisPanel from "./AIAnalysisPanel";
import {
  CalorieIcon,
  ProteinIcon,
  FatIcon,
  CarboIcon,
} from "./icons/NutrientIcons";

const API = "http://localhost:3002/api/menu";

interface MenuListProps {
  onEdit: (menuId: number) => void;
  onCreateNew: () => void;
}

// Determine porsi tag based on calories
function getPorsiTag(
  kalori: number | null | undefined,
): { label: string; cls: string } | null {
  const k = Number(kalori || 0);
  if (k <= 0) return null;
  if (k <= 450)
    return {
      label: "Porsi Kecil",
      cls: "bg-sky-100 text-sky-700 border-sky-200",
    };
  if (k >= 800)
    return {
      label: "Porsi Besar",
      cls: "bg-orange-100 text-orange-700 border-orange-200",
    };
  return {
    label: "Porsi Sedang",
    cls: "bg-gray-100 text-gray-600 border-gray-200",
  };
}

// Mini donut chart for macro nutrients
function MacroDonut({
  protein,
  karbo,
  lemak,
  size = 56,
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
        className="flex items-center justify-center rounded-full bg-gray-50 border border-gray-100"
      >
        <span className="text-[8px] text-gray-300">N/A</span>
      </div>
    );
  }

  const slices = [
    { value: karbo, color: "#8b5cf6", label: "K" },
    { value: protein, color: "#10b981", label: "P" },
    { value: lemak, color: "#f59e0b", label: "L" },
  ];

  let start = 0;
  const proteinPct = Math.round((protein / total) * 100);
  const karboPct = Math.round((karbo / total) * 100);
  const lemakPct = Math.round((lemak / total) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
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
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#10b981" }}
          />
          <span className="text-[9px] text-gray-500 font-medium">
            P {proteinPct}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#8b5cf6" }}
          />
          <span className="text-[9px] text-gray-500 font-medium">
            K {karboPct}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: "#f59e0b" }}
          />
          <span className="text-[9px] text-gray-500 font-medium">
            L {lemakPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MenuList({ onEdit, onCreateNew }: MenuListProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKategori, setFilterKategori] = useState("");
  const [filterPorsi, setFilterPorsi] = useState("");
  const [expandedMenuId, setExpandedMenuId] = useState<number | null>(null);
  const [analyzingMenuId, setAnalyzingMenuId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchMenus = () => {
    setLoading(true);
    fetch(API)
      .then((res) => res.json())
      .then((data) => setMenus(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMenus((prev) => prev.filter((m) => m.id !== id));
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMenus = menus.filter((m) => {
    const matchesSearch =
      m.nama.toLowerCase().includes(search.toLowerCase()) ||
      (m.deskripsi && m.deskripsi.toLowerCase().includes(search.toLowerCase()));
    const matchesKategori = !filterKategori || m.kategori === filterKategori;
    const porsiTag = getPorsiTag(m.kalori);
    const matchesPorsi =
      !filterPorsi || (porsiTag && porsiTag.label === filterPorsi);
    return matchesSearch && matchesKategori && matchesPorsi;
  });

  const kategoris = [...new Set(menus.map((m) => m.kategori))];

  const getKategoriColor = (kategori: string) => {
    const colors: Record<string, string> = {
      Siswa: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Balita: "bg-amber-100 text-amber-700 border-amber-200",
      "Ibu Hamil": "bg-rose-100 text-rose-700 border-rose-200",
    };
    return colors[kategori] || "bg-slate-100 text-slate-700 border-slate-200";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
            />
          </div>

          {/* Kategori Penerima filter */}
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="w-full md:w-48 pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm appearance-none"
            >
              <option value="">Semua Penerima</option>
              {kategoris.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Porsi filter */}
          <div className="relative">
            <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={filterPorsi}
              onChange={(e) => setFilterPorsi(e.target.value)}
              className="w-full md:w-44 pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm appearance-none"
            >
              <option value="">Semua Porsi</option>
              <option value="Porsi Kecil">Porsi Kecil</option>
              <option value="Porsi Sedang">Porsi Sedang</option>
              <option value="Porsi Besar">Porsi Besar</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Result Counter */}
      {!loading && menus.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Menampilkan{" "}
            <span className="font-semibold text-slate-700">
              {filteredMenus.length}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-slate-700">{menus.length}</span>{" "}
            menu
            {filterKategori && (
              <span className="ml-1 text-slate-400">
                — penerima{" "}
                <span className="font-semibold text-emerald-600">
                  {filterKategori}
                </span>
              </span>
            )}
            {filterPorsi && (
              <span className="ml-1 text-slate-400">
                —{" "}
                <span className="font-semibold text-blue-600">
                  {filterPorsi}
                </span>
              </span>
            )}
          </p>
          {(search || filterKategori || filterPorsi) && (
            <button
              onClick={() => {
                setSearch("");
                setFilterKategori("");
                setFilterPorsi("");
              }}
              className="text-xs font-semibold text-slate-400 hover:text-emerald-600 transition-colors"
            >
              Reset Filter
            </button>
          )}
        </div>
      )}

      {/* Menu Cards */}
      {filteredMenus.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <UtensilsCrossed className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">
            Belum Ada Menu
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Mulai dengan membuat menu pertama Anda.
          </p>
          <button
            onClick={onCreateNew}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-all shadow-md"
          >
            Buat Menu Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMenus.map((menu) => {
            const porsiTag = getPorsiTag(menu.kalori);
            const protein = Number(menu.protein || 0);
            const karbo = Number(menu.karbohidrat || 0);
            const lemak = Number(menu.lemak || 0);

            return (
              <div
                key={menu.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Image Thumbnail */}
                    {menu.gambar_url && (
                      <div className="shrink-0">
                        <img
                          src={menu.gambar_url}
                          alt={menu.nama}
                          className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-xl border-2 border-slate-200 shadow-sm"
                        />
                      </div>
                    )}

                    {/* Left: Menu Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-slate-800 truncate">
                          {menu.nama}
                        </h3>

                        {/* Tag: Kategori Penerima */}
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 border ${getKategoriColor(menu.kategori)}`}
                        >
                          👤 {menu.kategori}
                        </span>

                        {/* Tag: Porsi */}
                        {porsiTag && (
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 border ${porsiTag.cls}`}
                          >
                            🍽️ {porsiTag.label}
                          </span>
                        )}

                        {/* Tag: Status */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                            menu.is_active
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                          }`}
                        >
                          {menu.is_active ? "● Aktif" : "○ Nonaktif"}
                        </span>
                      </div>
                      {menu.deskripsi && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                          {menu.deskripsi}
                        </p>
                      )}

                      {/* Nutrition Quick View + Pie Chart */}
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Nutrition tags */}
                        <div className="flex flex-wrap gap-2">
                          {menu.kalori != null && (
                            <span className="text-xs font-medium bg-orange-50 text-orange-600 px-2.5 py-1 rounded-lg border border-orange-100 inline-flex items-center gap-2">
                              <CalorieIcon className="h-3 w-3" />
                              {menu.kalori} kkal
                            </span>
                          )}
                          {menu.protein != null && (
                            <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-100 inline-flex items-center gap-2">
                              <ProteinIcon className="h-3 w-3" />
                              {menu.protein}g protein
                            </span>
                          )}
                          {menu.lemak != null && (
                            <span className="text-xs font-medium bg-rose-50 text-rose-600 px-2.5 py-1 rounded-lg border border-rose-100 inline-flex items-center gap-2">
                              <FatIcon className="h-3 w-3" />
                              {menu.lemak}g lemak
                            </span>
                          )}
                          {menu.karbohidrat != null && (
                            <span className="text-xs font-medium bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg border border-amber-100 inline-flex items-center gap-2">
                              <CarboIcon className="h-3 w-3" />
                              {menu.karbohidrat}g karbo
                            </span>
                          )}
                        </div>

                        {/* Macro Donut Chart */}
                        <div className="shrink-0 ml-auto">
                          <MacroDonut
                            protein={protein}
                            karbo={karbo}
                            lemak={lemak}
                            size={48}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          setExpandedMenuId(
                            expandedMenuId === menu.id ? null : menu.id,
                          )
                        }
                        className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Detail</span>
                      </button>
                      <button
                        onClick={() =>
                          setAnalyzingMenuId(
                            analyzingMenuId === menu.id ? null : menu.id,
                          )
                        }
                        className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                          analyzingMenuId === menu.id
                            ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20"
                            : "bg-violet-100 hover:bg-violet-200 text-violet-700"
                        }`}
                        title="Analisis AI"
                      >
                        <Brain className="h-3.5 w-3.5" />
                        <span>
                          {analyzingMenuId === menu.id ? "Tutup AI" : "AI"}
                        </span>
                      </button>
                      <button
                        onClick={() => onEdit(menu.id)}
                        className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
                        title="Edit Menu"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      {deleteConfirm === menu.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(menu.id)}
                            className="px-3 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
                          >
                            Ya, Hapus
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(menu.id)}
                          className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors"
                          title="Hapus Menu"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Detail View */}
                {expandedMenuId === menu.id && (
                  <MenuDetailExpanded menuId={menu.id} />
                )}

                {/* AI Analysis is now shown in modal to keep cards compact */}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Analysis Modal */}
      {analyzingMenuId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Analisis AI</h3>
              <button
                onClick={() => setAnalyzingMenuId(null)}
                className="text-sm text-gray-500"
              >
                Tutup
              </button>
            </div>
            <AIAnalysisPanel
              menuId={analyzingMenuId}
              menuNama={menus.find((m) => m.id === analyzingMenuId)?.nama || ""}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Expanded menu detail
function MenuDetailExpanded({ menuId }: { menuId: number }) {
  const [detail, setDetail] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/${menuId}`)
      .then((res) => res.json())
      .then((data) => setDetail(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [menuId]);

  if (loading) {
    return (
      <div className="border-t border-slate-100 p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-3 py-1">
            <div className="h-3 bg-slate-200 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="border-t border-slate-100 p-6 bg-slate-50/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ingredients */}
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
            Bahan Baku
          </h4>
          {detail.ingredients && detail.ingredients.length > 0 ? (
            <div className="space-y-2">
              {detail.ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-white rounded-lg p-3 border border-slate-100"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {ing.nama_bahan}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {ing.jumlah} {ing.satuan}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Belum ada bahan baku
            </p>
          )}
        </div>

        {/* Nutrition */}
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
            Data Gizi
          </h4>
          {detail.nutrition ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Kalori",
                  value: detail.nutrition.kalori,
                  unit: "kkal",
                  color: "text-orange-600",
                },
                {
                  label: "Protein",
                  value: detail.nutrition.protein,
                  unit: "g",
                  color: "text-blue-600",
                },
                {
                  label: "Lemak",
                  value: detail.nutrition.lemak,
                  unit: "g",
                  color: "text-rose-600",
                },
                {
                  label: "Karbohidrat",
                  value: detail.nutrition.karbohidrat,
                  unit: "g",
                  color: "text-amber-600",
                },
                {
                  label: "Serat",
                  value: detail.nutrition.serat,
                  unit: "g",
                  color: "text-green-600",
                },
              ].map((n) => (
                <div
                  key={n.label}
                  className="bg-white rounded-lg p-3 border border-slate-100 text-center"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {n.label}
                  </p>
                  <p className={`text-lg font-black ${n.color}`}>{n.value}</p>
                  <p className="text-[10px] text-slate-400">{n.unit}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Belum ada data gizi</p>
          )}
        </div>
      </div>
    </div>
  );
}
