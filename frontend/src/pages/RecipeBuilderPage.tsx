import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChefHat,
  Clock3,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  Upload,
  X,
} from "lucide-react";
import type {
  GeneratedMenu,
  ManualMacronutrient,
  MenuIngredient,
  MenuKategori,
  MenuNutrition,
  PageView,
} from "../types";
import {
  CalorieIcon,
  CarboIcon,
  FatIcon,
  NutrientAssetIcon,
  ProteinIcon,
} from "../components/icons/NutrientIcons";
import {
  appendMenuEditLogs,
  clearEditTargetMenuId,
  createMenuEditLogEntry,
  getEditTargetMenuId,
  getMenuEditLogs,
  inferMenuPorsi,
  inferMenuType,
  loadMenuMetaMap,
  sanitizeMenuName,
  setMenuMeta,
  type MenuEditLogEntry,
  type MenuPorsi,
  type MenuType,
} from "../utils/menuMeta";

const API = "http://localhost:3002/api/menu";
const API_ORIGIN = "http://localhost:3002";
const KATEGORIS: MenuKategori[] = [
  "Siswa",
  "Balita",
  "Ibu Hamil",
  "Ibu Menyusui",
];
const SATUANS = [
  "g",
  "kg",
  "ml",
  "liter",
  "butir",
  "buah",
  "sdm",
  "sdt",
  "lembar",
];

const MENU_TYPES: Array<{ key: MenuType; label: string }> = [
  { key: "makanan", label: "Makanan" },
  { key: "minuman", label: "Minuman" },
];

const MENU_PORSI: Array<{ key: MenuPorsi; label: string }> = [
  { key: "porsi_kecil", label: "Porsi Kecil" },
  { key: "porsi_besar", label: "Porsi Besar" },
];

const MATERIAL_CATEGORY_FILTERS = [
  { key: "semua", label: "Semua", value: "" },
  { key: "karbo", label: "Karbohidrat", value: "karbo" },
  { key: "protein", label: "Protein", value: "protein" },
  { key: "sayur", label: "Sayuran", value: "sayur" },
  { key: "bumbu", label: "Bumbu", value: "bumbu" },
  { key: "lainnya", label: "Lainnya", value: "lainnya" },
];

const MATERIAL_PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='18' fill='%23ecfdf5'/%3E%3Ccircle cx='40' cy='40' r='18' fill='%232f7d46' opacity='.16'/%3E%3Cpath d='M25 48c12-2 22-12 30-24 2 17-8 29-30 24Z' fill='%232f7d46'/%3E%3C/svg%3E";

interface RecipeBuilderPageProps {
  onNavigate: (p: PageView) => void;
}

interface OriginalMenuSnapshot {
  nama: string;
  kategori: MenuKategori;
  menuType: MenuType;
  menuPorsi: MenuPorsi;
  hargaJual: number;
  ingredientCount: number;
  nutrition: MenuNutrition;
}

interface ManualMacroFormRow extends ManualMacronutrient {
  rowId: string;
}

interface RawMaterialOption {
  id: string;
  name: string;
  category: string;
  unit: string;
  standard_price: number;
  image_url?: string | null;
  quality_status?: string;
  availability?: {
    qty_available: number;
    min_stock_level: number;
    status: string;
  } | null;
}


const MANUAL_MACRO_OPTIONS = [
  { nama: "Gula", satuan: "g", note: "Pantau gula sederhana agar menu tidak berlebih." },
  { nama: "Omega-3", satuan: "g", note: "Lemak sehat dari ikan, telur, atau biji-bijian." },
  { nama: "Omega-6", satuan: "g", note: "Asam lemak esensial dari minyak nabati dan kacang." },
  { nama: "Omega-9", satuan: "g", note: "Lemak tak jenuh tunggal untuk variasi lemak sehat." },
  { nama: "Lemak Jenuh", satuan: "g", note: "Perlu dipantau agar tidak terlalu tinggi." },
  { nama: "Lemak Tak Jenuh", satuan: "g", note: "Lemak sehat dari ikan, alpukat, kacang, dan biji." },
  { nama: "Zat Besi", satuan: "mg", note: "Penting untuk ibu hamil dan pencegahan anemia." },
  { nama: "Kalsium", satuan: "mg", note: "Dukung tulang dan pertumbuhan anak." },
  { nama: "Zinc", satuan: "mg", note: "Mendukung imunitas dan pertumbuhan." },
  { nama: "Magnesium", satuan: "mg", note: "Mendukung fungsi otot, saraf, dan metabolisme." },
  { nama: "Kalium", satuan: "mg", note: "Membantu keseimbangan cairan dan fungsi otot." },
  { nama: "Fosfor", satuan: "mg", note: "Berperan dalam kesehatan tulang dan energi sel." },
  { nama: "Natrium", satuan: "mg", note: "Pantau agar rasa tetap aman dan tidak berlebih." },
  { nama: "Iodium", satuan: "mcg", note: "Penting untuk fungsi tiroid dan tumbuh kembang." },
  { nama: "Vitamin A", satuan: "mcg", note: "Baik untuk imunitas dan kesehatan mata." },
  { nama: "Vitamin B1", satuan: "mg", note: "Membantu metabolisme energi." },
  { nama: "Vitamin B2", satuan: "mg", note: "Mendukung metabolisme dan kesehatan jaringan." },
  { nama: "Vitamin B3", satuan: "mg", note: "Berperan dalam metabolisme karbohidrat dan lemak." },
  { nama: "Vitamin C", satuan: "mg", note: "Bantu penyerapan zat besi dan daya tahan." },
  { nama: "Vitamin D", satuan: "mcg", note: "Membantu penyerapan kalsium." },
  { nama: "Vitamin E", satuan: "mg", note: "Antioksidan untuk melindungi sel." },
  { nama: "Vitamin K", satuan: "mcg", note: "Mendukung pembekuan darah dan kesehatan tulang." },
  { nama: "Kolesterol", satuan: "mg", note: "Berguna untuk menu tinggi lauk hewani." },
  { nama: "Folat", satuan: "mcg", note: "Relevan untuk ibu hamil dan sayuran hijau." },
  { nama: "Air", satuan: "ml", note: "Catat komponen cairan bila menu berupa minuman atau sup." },
  { nama: "Antioksidan", satuan: "mg", note: "Umumnya berasal dari buah dan sayuran berwarna." },
  { nama: "Fitonutrien", satuan: "mg", note: "Senyawa tanaman dari sayur, buah, dan rempah." },
  { nama: "Probiotik", satuan: "cfu", note: "Bakteri baik dari yoghurt atau pangan fermentasi." },
];

const emptyIng: MenuIngredient = {
  raw_material_id: null,
  nama_bahan: "",
  jumlah: 0,
  satuan: "g",
  harga_satuan: 0,
  unit_snapshot: null,
  qty_available: null,
};

const emptyNut: MenuNutrition = {
  kalori: 0,
  protein: 0,
  lemak: 0,
  karbohidrat: 0,
  serat: 0,
};

function createMacroRow(seed?: Partial<ManualMacronutrient>): ManualMacroFormRow {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nama: seed?.nama || "",
    nilai: toNumber(seed?.nilai),
    satuan: seed?.satuan || "g",
  };
}

function resolveMenuImageUrl(gambarUrl: string | null | undefined) {
  if (!gambarUrl) return null;
  if (gambarUrl.startsWith("http://") || gambarUrl.startsWith("https://")) {
    return gambarUrl;
  }
  return `${API_ORIGIN}${gambarUrl}`;
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeNutrition(
  input?: Partial<MenuNutrition> | null,
): MenuNutrition {
  return {
    kalori: toNumber(input?.kalori),
    protein: toNumber(input?.protein),
    lemak: toNumber(input?.lemak),
    karbohidrat: toNumber(input?.karbohidrat),
    serat: toNumber(input?.serat),
  };
}

function convertIngredientCost(
  jumlah: number,
  inputUnit: string,
  baseUnit: string | null | undefined,
  hargaSatuan: number | undefined,
) {
  const qty = toNumber(jumlah);
  const price = toNumber(hargaSatuan);
  const from = String(inputUnit || "").toLowerCase();
  const to = String(baseUnit || inputUnit || "").toLowerCase();
  let normalizedQty = qty;
  if (from === "g" && to === "kg") normalizedQty = qty / 1000;
  if (from === "kg" && to === "g") normalizedQty = qty * 1000;
  if (from === "ml" && to === "liter") normalizedQty = qty / 1000;
  if (from === "liter" && to === "ml") normalizedQty = qty * 1000;
  return Math.round(normalizedQty * price);
}

function formatLogTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecipeBuilderPage({
  onNavigate,
}: RecipeBuilderPageProps) {
  // Form state
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState<MenuKategori>("Siswa");
  const [menuType, setMenuType] = useState<MenuType>("makanan");
  const [menuPorsi, setMenuPorsi] = useState<MenuPorsi>("porsi_kecil");
  const [, setHargaJual] = useState(0);
  const [caraMemasak, setCaraMemasak] = useState("kukus");
  const [rawMaterials, setRawMaterials] = useState<RawMaterialOption[]>([]);
  const [rawMaterialLoading, setRawMaterialLoading] = useState(false);
  const [rawMaterialError, setRawMaterialError] = useState<string | null>(null);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialCategory, setMaterialCategory] = useState("semua");
  const [materialUnit, setMaterialUnit] = useState("semua");
  const [materialStockStatus, setMaterialStockStatus] = useState("semua");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([]);
  const [nutrition, setNutrition] = useState<MenuNutrition>({ ...emptyNut });
  const [manualMacros, setManualMacros] = useState<ManualMacroFormRow[]>([]);
  const [macroPickerRowId, setMacroPickerRowId] = useState<string | null>(null);
  const [macroSearch, setMacroSearch] = useState("");
  const [aiIngredientWarnings, setAiIngredientWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Edit mode state
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] =
    useState<OriginalMenuSnapshot | null>(null);
  const [editLogs, setEditLogs] = useState<MenuEditLogEntry[]>([]);

  // Optional image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // AI Generate state
  const [aiKelompok, setAiKelompok] = useState<MenuKategori>("Siswa");
  const [aiCaraMasak, setAiCaraMasak] = useState("kukus");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<GeneratedMenu | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRawMaterials() {
      setRawMaterialLoading(true);
      setRawMaterialError(null);
      try {
        const res = await fetch(
          `${API}/raw-materials?status=active&include=availability&kitchen_id=k-1`,
        );
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data.message || data.error || "Gagal memuat bahan baku",
          );
        if (!cancelled)
          setRawMaterials(Array.isArray(data.data) ? data.data : []);
      } catch (err: unknown) {
        if (!cancelled)
          setRawMaterialError(
            err instanceof Error ? err.message : "Gagal memuat bahan baku",
          );
      } finally {
        if (!cancelled) setRawMaterialLoading(false);
      }
    }
    loadRawMaterials();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const editId = getEditTargetMenuId();
    if (!editId) return;

    setEditingMenuId(editId);
    setLoadingEdit(true);

    fetch(`${API}/${editId}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const menu = data as {
          id: number;
          nama: string;
          kategori: MenuKategori;
          harga_jual?: number;
          cara_memasak?: string | null;
          deskripsi?: string | null;
          gambar_url?: string | null;
          kalori?: number;
          ingredients?: MenuIngredient[];
          nutrition?: MenuNutrition | null;
          manual_macronutrients?: ManualMacronutrient[];
        };

        const cleanName = sanitizeMenuName(menu.nama || "");
        const loadedIngredients = Array.isArray(menu.ingredients)
          ? menu.ingredients.map((item) => ({
              ...item,
              jumlah: toNumber(item.jumlah),
              raw_material_id: item.raw_material_id || null,
              harga_satuan: toNumber(item.harga_satuan),
              unit_snapshot: item.unit_snapshot || item.satuan,
              quality_status_snapshot: item.quality_status_snapshot || null,
              availability_status_snapshot:
                item.availability_status_snapshot || null,
              qty_available: item.qty_available ?? null,
            }))
          : [];

        const normalizedIng =
          loadedIngredients.length > 0 ? loadedIngredients : [{ ...emptyIng }];
        const normalizedNut = normalizeNutrition(menu.nutrition);

        setNama(cleanName);
        setKategori(menu.kategori || "Siswa");
        setHargaJual(toNumber(menu.harga_jual));
        setCaraMemasak(menu.cara_memasak || "kukus");
        setIngredients(normalizedIng);
        setNutrition(normalizedNut);
        setManualMacros(
          Array.isArray(menu.manual_macronutrients)
            ? menu.manual_macronutrients.map((item) =>
                createMacroRow({ nama: item.nama, nilai: item.nilai, satuan: item.satuan }),
              )
            : [],
        );
        setImageFile(null);
        setImagePreview(resolveMenuImageUrl(menu.gambar_url || null));

        const metaMap = loadMenuMetaMap();
        const resolvedType =
          metaMap[editId]?.type ||
          inferMenuType({
            nama: menu.nama || "",
            deskripsi: menu.deskripsi || "",
          });
        const resolvedPorsi =
          metaMap[editId]?.porsi ||
          inferMenuPorsi(normalizedNut.kalori || menu.kalori || 0);

        setMenuType(resolvedType);
        setMenuPorsi(resolvedPorsi);
        setAiKelompok(menu.kategori || "Siswa");

        const snapshot: OriginalMenuSnapshot = {
          nama: cleanName,
          kategori: menu.kategori || "Siswa",
          menuType: resolvedType,
          menuPorsi: resolvedPorsi,
          hargaJual: toNumber(menu.harga_jual),
          ingredientCount: normalizedIng.filter((i) => i.nama_bahan.trim())
            .length,
          nutrition: normalizedNut,
        };

        setOriginalSnapshot(snapshot);
        setEditLogs(getMenuEditLogs(editId));
      })
      .catch((error) => {
        console.error(error);
        setSaveMsg({
          type: "error",
          text: "Gagal memuat data menu untuk mode edit.",
        });
      })
      .finally(() => setLoadingEdit(false));
  }, []);

  const isEditMode = editingMenuId !== null;

  const validIngredients = useMemo(
    () => ingredients.filter((item) => item.nama_bahan.trim()),
    [ingredients],
  );

  const buildSnapshot = (
    baseName: string,
    nextKategori: MenuKategori,
    nextMenuType: MenuType,
    nextMenuPorsi: MenuPorsi,
    nextHargaJual: number,
    nextIngredients: MenuIngredient[],
    nextNutrition: MenuNutrition,
  ): OriginalMenuSnapshot => ({
    nama: baseName,
    kategori: nextKategori,
    menuType: nextMenuType,
    menuPorsi: nextMenuPorsi,
    hargaJual: nextHargaJual,
    ingredientCount: nextIngredients.filter((i) => i.nama_bahan.trim()).length,
    nutrition: normalizeNutrition(nextNutrition),
  });

  const buildChangeLogs = (
    menuId: number,
    before: OriginalMenuSnapshot,
    after: OriginalMenuSnapshot,
  ) => {
    const logs: MenuEditLogEntry[] = [];

    const pushIfDifferent = (
      field: string,
      oldValue: string,
      newValue: string,
    ) => {
      if (oldValue === newValue) return;
      logs.push(createMenuEditLogEntry(menuId, field, oldValue, newValue));
    };

    pushIfDifferent("Nama Menu", before.nama, after.nama);
    pushIfDifferent("Kelompok", before.kategori, after.kategori);
    pushIfDifferent(
      "Jenis Menu",
      before.menuType === "makanan" ? "Makanan" : "Minuman",
      after.menuType === "makanan" ? "Makanan" : "Minuman",
    );
    pushIfDifferent(
      "Kategori Porsi",
      before.menuPorsi === "porsi_besar" ? "Porsi Besar" : "Porsi Kecil",
      after.menuPorsi === "porsi_besar" ? "Porsi Besar" : "Porsi Kecil",
    );
    pushIfDifferent(
      "Harga Jual",
      String(before.hargaJual),
      String(after.hargaJual),
    );
    pushIfDifferent(
      "Jumlah Bahan",
      String(before.ingredientCount),
      String(after.ingredientCount),
    );

    const nutrientFields: Array<keyof MenuNutrition> = [
      "kalori",
      "protein",
      "lemak",
      "karbohidrat",
      "serat",
    ];

    nutrientFields.forEach((key) => {
      pushIfDifferent(
        `Nutrisi: ${key}`,
        String(before.nutrition[key]),
        String(after.nutrition[key]),
      );
    });

    return logs;
  };

  // Ingredient handlers
  const removeIng = (i: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, idx) => idx !== i));
    }
  };

  const updateIng = (
    i: number,
    field: keyof MenuIngredient,
    val: string | number,
  ) => {
    const updated = [...ingredients];
    (updated[i] as unknown as Record<string, unknown>)[field] = val;
    setIngredients(updated);
  };

  const existingMaterialIds = useMemo(
    () =>
      new Set(
        ingredients
          .map((item) => item.raw_material_id)
          .filter(Boolean) as string[],
      ),
    [ingredients],
  );

  const materialUnits = useMemo(
    () =>
      Array.from(
        new Set(rawMaterials.map((item) => item.unit).filter(Boolean)),
      ).sort(),
    [rawMaterials],
  );

  const filteredRawMaterials = useMemo(() => {
    const search = materialSearch.trim().toLowerCase();
    const categoryValue =
      MATERIAL_CATEGORY_FILTERS.find((item) => item.key === materialCategory)
        ?.value || "";
    return rawMaterials.filter((material) => {
      const matchesSearch =
        !search || material.name.toLowerCase().includes(search);
      const matchesCategory =
        !categoryValue || material.category === categoryValue;
      const matchesUnit =
        materialUnit === "semua" || material.unit === materialUnit;
      const status = material.availability?.status || "unknown";
      const matchesStock =
        materialStockStatus === "semua" || status === materialStockStatus;
      return matchesSearch && matchesCategory && matchesUnit && matchesStock;
    });
  }, [
    materialCategory,
    materialSearch,
    materialStockStatus,
    materialUnit,
    rawMaterials,
  ]);

  const toggleMaterialSelection = (materialId: string) => {
    if (existingMaterialIds.has(materialId)) {
      setIngredients((prev) => prev.filter((item) => item.raw_material_id !== materialId));
      return;
    }
    setSelectedMaterialIds((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId],
    );
  };

  const appendSelectedMaterials = () => {
    const toAppend = selectedMaterialIds
      .filter((id) => !existingMaterialIds.has(id))
      .map((id) => rawMaterials.find((material) => material.id === id))
      .filter(Boolean) as RawMaterialOption[];

    if (toAppend.length === 0) {
      setMaterialModalOpen(false);
      return;
    }

    setIngredients((prev) => {
      return [
        ...prev,
        ...toAppend.map((material) => ({
          raw_material_id: material.id,
          nama_bahan: material.name,
          jumlah: 1,
          satuan: material.unit,
          harga_satuan: material.standard_price || 0,
          unit_snapshot: material.unit,
          quality_status_snapshot: material.quality_status || null,
          availability_status_snapshot: material.availability?.status || null,
          qty_available: material.availability?.qty_available ?? null,
        })),
      ];
    });
    setSelectedMaterialIds([]);
    setMaterialModalOpen(false);
  };

  const resetMaterialFilters = () => {
    setMaterialSearch("");
    setMaterialCategory("semua");
    setMaterialUnit("semua");
    setMaterialStockStatus("semua");
  };

  // Nutrition handler
  const updateNut = (field: keyof MenuNutrition, val: number) =>
    setNutrition({ ...nutrition, [field]: val });



  const addManualMacro = () => {
    setManualMacros((prev) => [...prev, createMacroRow()]);
  };

  const removeManualMacro = (rowId: string) => {
    setManualMacros((prev) => prev.filter((item) => item.rowId !== rowId));
  };

  const updateManualMacro = (
    rowId: string,
    field: keyof ManualMacronutrient,
    value: string | number,
  ) => {
    setManualMacros((prev) =>
      prev.map((item) => (item.rowId === rowId ? { ...item, [field]: value } : item)),
    );
  };

  const filteredMacroOptions = useMemo(() => {
    const q = macroSearch.trim().toLowerCase();
    if (!q) return MANUAL_MACRO_OPTIONS;
    return MANUAL_MACRO_OPTIONS.filter(
      (item) =>
        item.nama.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.satuan.toLowerCase().includes(q),
    );
  }, [macroSearch]);

  const selectManualMacro = (
    rowId: string,
    option: (typeof MANUAL_MACRO_OPTIONS)[number],
  ) => {
    setManualMacros((prev) =>
      prev.map((item) =>
        item.rowId === rowId ? { ...item, nama: option.nama, satuan: option.satuan } : item,
      ),
    );
    setMacroPickerRowId(null);
    setMacroSearch("");
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveMsg({
        type: "error",
        text: "File gambar tidak valid. Gunakan JPG, PNG, WebP, atau GIF.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveMsg({
        type: "error",
        text: "Ukuran gambar maksimal 5MB.",
      });
      return;
    }

    setImageFile(file);
    setSaveMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadMenuImage = async (menuId: number) => {
    if (!imageFile) return;

    const formData = new FormData();
    formData.append("image", imageFile);
    setUploadingImage(true);

    try {
      const uploadRes = await fetch(`${API}/${menuId}/upload-image`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Gagal upload gambar menu");
      }

      setImageFile(null);
      setImagePreview(resolveMenuImageUrl(uploadData.gambar_url));
    } finally {
      setUploadingImage(false);
    }
  };

  // Save menu (create / edit)
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    const cleanedName = sanitizeMenuName(nama);
    if (!cleanedName) return;

    if (validIngredients.length === 0) {
      setSaveMsg({ type: "error", text: "Minimal satu bahan harus diisi" });
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    const validManualMacros = manualMacros
      .filter((item) => item.nama.trim())
      .map((item) => ({
        nama: item.nama.trim(),
        nilai: toNumber(item.nilai),
        satuan: item.satuan.trim() || "g",
      }));

    try {
      const endpoint = isEditMode ? `${API}/${editingMenuId}` : API;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: cleanedName,
          kategori,
          deskripsi: "",
          cara_memasak: caraMemasak,
          harga_jual: hppEstimate,
          ingredients: validIngredients,
          nutrition,
          manual_macronutrients: validManualMacros,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      const currentMenuId = isEditMode
        ? Number(editingMenuId)
        : Number(data?.data?.id);

      if (imageFile && Number.isFinite(currentMenuId) && currentMenuId > 0) {
        try {
          await uploadMenuImage(currentMenuId);
        } catch (uploadErr: unknown) {
          const uploadMessage =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Menu tersimpan, tetapi upload gambar gagal.";
          setSaveMsg({
            type: "error",
            text: `Menu tersimpan, tetapi upload gambar gagal: ${uploadMessage}`,
          });
        }
      }

      if (Number.isFinite(currentMenuId) && currentMenuId > 0) {
        setMenuMeta(currentMenuId, {
          type: menuType,
          porsi: menuPorsi,
        });
      }

      if (isEditMode && editingMenuId && originalSnapshot) {
        const nextSnapshot = buildSnapshot(
          cleanedName,
          kategori,
          menuType,
          menuPorsi,
          hppEstimate,
          validIngredients,
          nutrition,
        );
        const changes = buildChangeLogs(
          editingMenuId,
          originalSnapshot,
          nextSnapshot,
        );

        if (changes.length > 0) {
          appendMenuEditLogs(editingMenuId, changes);
          setEditLogs(getMenuEditLogs(editingMenuId));
          setOriginalSnapshot(nextSnapshot);
          setSaveMsg({
            type: "success",
            text: `Menu berhasil diperbarui (${changes.length} perubahan dicatat).`,
          });
        } else {
          setSaveMsg({
            type: "success",
            text: "Menu tersimpan tanpa perubahan data yang signifikan.",
          });
        }
      } else {
        setSaveMsg({ type: "success", text: "Menu berhasil disimpan!" });
      }

      setNama(cleanedName);

      setTimeout(() => {
        clearEditTargetMenuId();
        onNavigate("menu-catalog");
      }, 1200);
    } catch (err: unknown) {
      setSaveMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
    } finally {
      setSaving(false);
    }
  };

  // AI Generate
  const handleAIGenerate = async () => {
    if (!aiCaraMasak.trim()) {
      setAiError("Masukkan cara masak");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const res = await fetch(`${API}/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kelompok: aiKelompok,
          kategori: aiKelompok,
          cara_masak: aiCaraMasak,
          kitchen_id: "k-1",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI gagal generate menu");

      setAiResult(data as GeneratedMenu);
      setNama(sanitizeMenuName(data.nama_menu));
      setKategori(aiKelompok);
      setMenuType("makanan");
      setCaraMemasak(data.metode_masak || aiCaraMasak);
      setNutrition({
        kalori: data.estimasi_gizi.kalori || 0,
        protein: data.estimasi_gizi.protein || 0,
        lemak: data.estimasi_gizi.lemak || 0,
        karbohidrat: data.estimasi_gizi.karbohidrat || 0,
        serat: data.estimasi_gizi.serat || 0,
      });
      if (data.bahan_digunakan?.length > 0) {
        const warnings: string[] = [];
        const matchedIngredients = data.bahan_digunakan.flatMap(
          (b: {
            nama: string;
            raw_material_id?: string | null;
            jumlah: number;
            satuan: string;
          }) => {
            const material = rawMaterials.find(
              (item) => String(item.id) === String(b.raw_material_id || ""),
            );
            if (!material) {
              warnings.push(`${b.nama || b.raw_material_id || "Bahan"} tidak ditemukan di stok.`);
              return [];
            }
            return [{
              nama_bahan: material.name,
              jumlah: toNumber(b.jumlah),
              satuan: b.satuan || material.unit,
              raw_material_id: material.id,
              harga_satuan: toNumber(material.standard_price),
              unit_snapshot: material.unit,
              quality_status_snapshot: material.quality_status || null,
              availability_status_snapshot: material.availability?.status || null,
              qty_available: material.availability?.qty_available ?? null,
            }];
          },
        );
        setAiIngredientWarnings(warnings);
        if (matchedIngredients.length > 0) setIngredients(matchedIngredients);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAiLoading(false);
    }
  };

  // HPP estimate
  const hppEstimate = useMemo(
    () =>
      ingredients.reduce(
        (sum, ing) =>
          sum +
          convertIngredientCost(
            ing.jumlah,
            ing.satuan,
            ing.unit_snapshot || ing.satuan,
            ing.harga_satuan,
          ),
        0,
      ),
    [ingredients],
  );

  useEffect(() => {
    setHargaJual(hppEstimate);
  }, [hppEstimate]);

  if (loadingEdit) {
    return (
      <div className="p-6">
        <div className="card flex items-center justify-center gap-3 p-10 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat data menu untuk mode edit...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="page-shell space-y-6"
    >
      <div className="page-header">
        <div className="flex items-start gap-3">
          <button
            onClick={() => {
              clearEditTargetMenuId();
              onNavigate("menu-catalog");
            }}
            className="mt-1 rounded-[18px] border border-white/70 bg-white/90 p-3 text-ink-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <span className="soft-badge">
              {isEditMode ? "Edit Mode" : "Create Menu"}
            </span>
            <div className="mt-4 flex items-center gap-3">
              <div className="rounded-[20px] bg-forest-50 p-3">
                <ChefHat className="h-6 w-6 text-forest-800" />
              </div>
              <div>
                <h1 className="page-title text-[2rem]">
                  {isEditMode ? "Edit Menu" : "Recipe Builder"}
                </h1>
                <p className="page-subtitle mt-1">
                  {isEditMode
                    ? "Perbarui menu dan lihat histori perubahannya."
                    : "Tambah menu baru dengan form yang lebih rapi, lega, dan mudah dipindai."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {isEditMode && (
          <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
            Edit ID #{editingMenuId}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <form
            onSubmit={handleSave}
            className="card space-y-6 rounded-[32px] p-6 sm:p-7"
          >
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Nama Menu
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Masukkan nama menu"
                required
                className="w-full px-4 py-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Kelompok
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as MenuKategori)}
                  className="w-full px-4 py-3 text-sm"
                >
                  {KATEGORIS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Harga Jual (Rp)
                </label>
                <input
                  type="number"
                  value={hppEstimate || ""}
                  readOnly
                  min={0}
                  placeholder="0"
                  className="w-full bg-gray-50 px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Jenis Menu
                </label>
                <div className="flex gap-1 rounded-xl bg-forest-50 p-1">
                  {MENU_TYPES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMenuType(item.key)}
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                        menuType === item.key
                          ? "bg-forest-900 text-white"
                          : "text-gray-600 hover:bg-white/70"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Kategori Porsi
                </label>
                <div className="flex gap-1 rounded-xl bg-forest-50 p-1">
                  {MENU_PORSI.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMenuPorsi(item.key)}
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                        menuPorsi === item.key
                          ? "bg-forest-900 text-white"
                          : "text-gray-600 hover:bg-white/70"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Metode Memasak
                </label>
                <select
                  value={caraMemasak}
                  onChange={(e) => setCaraMemasak(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="kukus">Kukus</option>
                  <option value="rebus">Rebus</option>
                  <option value="tumis">Tumis</option>
                  <option value="bakar">Bakar</option>
                  <option value="goreng">Goreng</option>
                </select>
              </div>
            </div>

            <div className="rounded-[26px] border border-dashed border-forest-200 bg-forest-50/60 p-5">
              <div className="mb-3 flex items-start gap-2">
                <div className="rounded-xl bg-white p-2 text-forest-700 shadow-sm">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Gambar Menu (Opsional)
                  </p>
                  <p className="text-xs text-gray-500">
                    Jika tidak diunggah, kartu menu akan memakai placeholder
                    ikon.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview gambar menu"
                      className="h-24 w-24 rounded-2xl border border-forest-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-forest-200 bg-white text-forest-300">
                      <ChefHat className="h-8 w-8" />
                    </div>
                  )}

                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute -right-2 -top-2 rounded-full bg-emerald-600 p-1 text-white shadow-sm hover:bg-emerald-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <label className="cursor-pointer rounded-[18px] border border-forest-200 bg-white px-4 py-3 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-100">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <span className="inline-flex items-center gap-1.5">
                    <Upload className="h-4 w-4" />
                    {imagePreview ? "Ganti Gambar" : "Pilih Gambar"}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Bahan
                  </label>
                  <p className="text-xs text-gray-400">
                    Bahan hanya dipilih dari API bahan baku agar stok dan harga valid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(true)}
                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <Plus className="h-3 w-3" /> Tambah Bahan
                </button>
              </div>

              {rawMaterialLoading && (
                <p className="mb-2 text-xs text-gray-400">
                  Memuat bahan baku...
                </p>
              )}
              {rawMaterialError && (
                <p className="mb-2 text-xs text-amber-600">
                  {rawMaterialError}
                </p>
              )}

              {ingredients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-gray-400">
                  Belum ada bahan. Klik Tambah Bahan untuk memilih dari stok.
                </div>
              ) : (
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div
                      key={`${ing.raw_material_id || ing.nama_bahan}-${idx}`}
                      className="grid items-center gap-2"
                      style={{ gridTemplateColumns: "1.4fr 80px 90px 90px 32px" }}
                    >
                      <div className="space-y-1 rounded-[16px] bg-slate-50 px-3 py-2.5 text-sm">
                        <p className="font-semibold text-gray-700">{ing.nama_bahan}</p>
                        {ing.qty_available !== null && ing.qty_available !== undefined && (
                          <p className="text-[10px] text-gray-400">
                            Stok info: {Number(ing.qty_available).toLocaleString("id-ID")} {ing.unit_snapshot || ing.satuan}
                          </p>
                        )}
                      </div>
                      <input
                        type="number"
                        value={ing.jumlah || ""}
                        onChange={(e) => updateIng(idx, "jumlah", Number(e.target.value))}
                        placeholder="Qty"
                        min={0}
                        step={0.01}
                        className="rounded-[16px] px-3 py-2.5 text-sm"
                      />
                      <select
                        value={ing.satuan}
                        onChange={(e) => updateIng(idx, "satuan", e.target.value)}
                        className="rounded-[16px] px-3 py-2.5 text-sm"
                      >
                        {SATUANS.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={ing.harga_satuan || ""}
                        readOnly
                        placeholder="Harga/satuan"
                        className="rounded-[16px] bg-gray-50 px-3 py-2.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeIng(idx)}
                        className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {hppEstimate > 0 && (
                <div className="mt-3 flex justify-between rounded-xl bg-forest-50 p-3 text-sm">
                  <span className="text-gray-500">Estimasi HPP per porsi</span>
                  <span className="font-bold text-forest-800">
                    Rp {hppEstimate.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-700">
                Input Nutrisi
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    {
                      key: "kalori" as const,
                      label: "Calories (kcal)",
                      icon: <CalorieIcon className="h-5 w-5" />,
                    },
                    {
                      key: "protein" as const,
                      label: "Protein (g)",
                      icon: <ProteinIcon className="h-5 w-5" />,
                    },
                    {
                      key: "lemak" as const,
                      label: "Fat (g)",
                      icon: <FatIcon className="h-5 w-5" />,
                    },
                    {
                      key: "karbohidrat" as const,
                      label: "Carbs (g)",
                      icon: <CarboIcon className="h-5 w-5" />,
                    },
                    {
                      key: "serat" as const,
                      label: "Fiber (g)",
                      icon: (
                        <NutrientAssetIcon name="Serat" className="h-5 w-5" />
                      ),
                    },
                  ] satisfies {
                    key: keyof MenuNutrition;
                    label: string;
                    icon: ReactNode;
                  }[]
                ).map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-forest-50">
                        {f.icon}
                      </span>
                      <span>{f.label}</span>
                    </label>
                    <input
                      type="number"
                      value={nutrition[f.key] || ""}
                      onChange={(e) => updateNut(f.key, Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      step={0.1}
                      className="w-full px-3 py-2.5 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Mikronutrien Tambahan (Opsional)
                    </p>
                    <p className="text-xs text-gray-500">
                      Tambahkan gula, vitamin, mineral, atau nutrien mikro secara manual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addManualMacro}
                    className="rounded-xl border border-forest-200 bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Plus className="h-3 w-3" /> Tambah Mikronutrien
                    </span>
                  </button>
                </div>

                {manualMacros.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Belum ada mikronutrien tambahan.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {manualMacros.map((item) => (
                      <div
                        key={item.rowId}
                        className="grid items-center gap-2"
                        style={{ gridTemplateColumns: "1fr 110px 90px 32px" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMacroPickerRowId(item.rowId);
                            setMacroSearch(item.nama);
                          }}
                          className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition hover:border-forest-200 hover:bg-forest-50"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-forest-50">
                            {item.nama ? (
                              <NutrientAssetIcon name={item.nama} className="h-5 w-5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 text-forest-700" />
                            )}
                          </span>
                          <span className="truncate">
                            {item.nama || "Pilih nutrien"}
                          </span>
                        </button>
                        <input
                          type="number"
                          value={item.nilai || ""}
                          onChange={(e) => updateManualMacro(item.rowId, "nilai", Number(e.target.value))}
                          min={0}
                          step={0.1}
                          placeholder="Nilai"
                          className="rounded-[14px] px-3 py-2.5 text-sm"
                        />
                        <input
                          type="text"
                          value={item.satuan}
                          onChange={(e) => updateManualMacro(item.rowId, "satuan", e.target.value)}
                          placeholder="g"
                          className="rounded-[14px] px-3 py-2.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeManualMacro(item.rowId)}
                          className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {saveMsg && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-sm ${saveMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-emerald-50 text-emerald-700"}`}
              >
                {saveMsg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-emerald-700" />
                )}
                {saveMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || uploadingImage}
                className="btn-primary flex flex-1 items-center justify-center gap-2 py-3 disabled:opacity-60"
              >
                {saving || uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "💾"
                )}
                {uploadingImage
                  ? "Mengunggah Gambar..."
                  : isEditMode
                    ? "Simpan Perubahan"
                    : "Simpan Menu"}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearEditTargetMenuId();
                  onNavigate("menu-catalog");
                }}
                className="btn-secondary px-6 py-3 text-sm"
              >
                Batal
              </button>
            </div>

            {isEditMode && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-amber-700" />
                  <h4 className="text-sm font-bold text-amber-800">
                    Log Perubahan Menu
                  </h4>
                </div>

                {editLogs.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    Belum ada riwayat perubahan pada menu ini.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {editLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-amber-100 bg-white px-3 py-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-gray-700">
                            {log.field}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatLogTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {log.oldValue || "(kosong)"} →{" "}
                          {log.newValue || "(kosong)"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-4">
          <div className="card rounded-[32px] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-forest-700" />
              <h3 className="text-base font-bold text-gray-800">
                AI Menu Generator
              </h3>
            </div>
            <p className="mb-4 text-xs text-gray-400">
              AI mengambil bahan baku aktif dari API bahan baku. Generator ini
              hanya membuat menu makanan; menu minuman/susu tetap dibuat ahli
              gizi.
            </p>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-600">
                Cara Masak
              </label>
              <select
                value={aiCaraMasak}
                onChange={(e) => setAiCaraMasak(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="kukus">Kukus</option>
                <option value="rebus">Rebus</option>
                <option value="tumis">Tumis</option>
                <option value="bakar">Bakar</option>
                <option value="goreng">Goreng</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-600">
                Target Penerima
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-forest-50 p-1">
                {KATEGORIS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setAiKelompok(item)}
                    className={`rounded-lg py-1.5 text-[10px] font-semibold transition-all ${
                      aiKelompok === item
                        ? "bg-forest-900 text-white"
                        : "text-gray-500 hover:text-forest-700"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {aiError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {aiError}
              </div>
            )}

            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              {aiLoading ? "AI sedang memproses..." : "Generate Menu dengan AI"}
            </button>
          </div>

          {aiResult && (
            <div className="card space-y-3 rounded-[32px] p-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h4 className="font-bold text-gray-800">
                  {sanitizeMenuName(aiResult.nama_menu)}
                </h4>
                {aiResult.sesuai_target && (
                  <span className="ml-auto rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-bold text-forest-800">
                    Sesuai Target
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{aiResult.deskripsi}</p>
              <p className="text-xs text-gray-400">
                Metode:{" "}
                <span className="font-semibold text-gray-600">
                  {aiResult.metode_masak}
                </span>
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    {
                      label: "Kalori",
                      val: aiResult.estimasi_gizi.kalori,
                      unit: "kkal",
                    },
                    {
                      label: "Protein",
                      val: aiResult.estimasi_gizi.protein,
                      unit: "g",
                    },
                    {
                      label: "Lemak",
                      val: aiResult.estimasi_gizi.lemak,
                      unit: "g",
                    },
                    {
                      label: "Karbo",
                      val: aiResult.estimasi_gizi.karbohidrat,
                      unit: "g",
                    },
                    {
                      label: "Serat",
                      val: aiResult.estimasi_gizi.serat,
                      unit: "g",
                    },
                  ] as const
                ).map((n) => (
                  <div
                    key={n.label}
                    className="rounded-lg bg-forest-50 p-2 text-center"
                  >
                    <NutrientAssetIcon
                      name={n.label}
                      className="mx-auto mb-1 h-5 w-5"
                    />
                    <p className="text-[9px] text-gray-400">{n.label}</p>
                    <p className="text-sm font-bold text-forest-800">
                      {n.val}
                      <span className="ml-0.5 text-[9px] font-normal">
                        {n.unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>



              {aiIngredientWarnings.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Bahan AI Diabaikan
                  </p>
                  {aiIngredientWarnings.map((message, i) => (
                    <p key={i} className="text-[10px] text-amber-600">
                      ? {message}
                    </p>
                  ))}
                </div>
              )}

              {aiResult.tips_gizi && (
                <div className="rounded-xl bg-forest-50 p-3 text-xs text-forest-800">
                  💡 {aiResult.tips_gizi}
                </div>
              )}

              {aiResult.bahan_kurang?.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Bahan Kurang
                  </p>
                  {aiResult.bahan_kurang.map((b, i) => (
                    <p key={i} className="text-[10px] text-amber-600">
                      • {b.nama}: butuh {b.jumlah_butuh} {b.satuan} — {b.alasan}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {macroPickerRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-[26px] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700/80">
                  Pilih Mikronutrien
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-800">
                  Nutrien Manual
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Cari lalu pilih nutrien tambahan yang paling relevan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMacroPickerRowId(null);
                  setMacroSearch("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-forest-50 hover:text-forest-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={macroSearch}
                onChange={(e) => setMacroSearch(e.target.value)}
                placeholder="Cari gula, omega, vitamin, mineral..."
                className="w-full py-3 pl-10 pr-4 text-sm"
              />
            </div>

            <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
              {filteredMacroOptions.map((option) => (
                <button
                  key={option.nama}
                  type="button"
                  onClick={() => selectManualMacro(macroPickerRowId, option)}
                  className="w-full rounded-[18px] border border-gray-100 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-forest-200 hover:bg-forest-50 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-50">
                        <NutrientAssetIcon name={option.nama} className="h-8 w-8" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800">{option.nama}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{option.note}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-forest-100 px-2.5 py-1 text-[10px] font-bold text-forest-800">
                      {option.satuan}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {materialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-gray-100 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-ink-800">
                    Pemilihan Bahan Baku
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Pilih bahan baku untuk recipe builder, lalu atur jumlah dan
                    satuannya.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(false)}
                  className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={materialSearch}
                      onChange={(e) => setMaterialSearch(e.target.value)}
                      placeholder="Cari bahan baku"
                      className="w-full rounded-[16px] py-3 pl-10 pr-3 text-sm"
                    />
                  </div>
                  <select
                    value={materialCategory}
                    onChange={(e) => setMaterialCategory(e.target.value)}
                    className="rounded-[16px] px-3 py-3 text-sm"
                  >
                    {MATERIAL_CATEGORY_FILTERS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={materialUnit}
                    onChange={(e) => setMaterialUnit(e.target.value)}
                    className="rounded-[16px] px-3 py-3 text-sm"
                  >
                    <option value="semua">Semua satuan</option>
                    {materialUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  <select
                    value={materialStockStatus}
                    onChange={(e) => setMaterialStockStatus(e.target.value)}
                    className="rounded-[16px] px-3 py-3 text-sm"
                  >
                    <option value="semua">Semua stok</option>
                    <option value="available">Tersedia</option>
                    <option value="low_stock">Stok menipis</option>
                    <option value="out_of_stock">Kosong</option>
                  </select>
                  <button
                    type="button"
                    onClick={resetMaterialFilters}
                    className="rounded-[16px] border border-forest-100 px-4 py-3 text-sm font-semibold text-forest-700 hover:bg-forest-50"
                  >
                    Reset Filter
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {MATERIAL_CATEGORY_FILTERS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMaterialCategory(item.key)}
                      className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                        materialCategory === item.key
                          ? "border-forest-800 bg-forest-800 text-white"
                          : "border-gray-100 bg-white text-gray-600 hover:border-forest-200 hover:text-forest-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-5 py-4 sm:px-6">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-gray-400">
                  <tr className="border-b border-gray-100">
                    <th className="py-3 pr-4">Nama Bahan</th>
                    <th className="py-3 pr-4">Kategori</th>
                    <th className="py-3 pr-4">Satuan</th>
                    <th className="py-3 pr-4">Harga</th>
                    <th className="py-3 pr-4">Stok</th>
                    <th className="py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRawMaterials.map((material) => {
                    const isExisting = existingMaterialIds.has(material.id);
                    const isSelected = selectedMaterialIds.includes(
                      material.id,
                    );
                    const stockStatus =
                      material.availability?.status || "unknown";
                    return (
                      <tr
                        key={material.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                material.image_url || MATERIAL_PLACEHOLDER_IMAGE
                              }
                              alt={material.name}
                              className="h-11 w-11 rounded-xl object-cover"
                            />
                            <div>
                              <p className="font-semibold text-ink-700">
                                {material.name}
                              </p>
                              {(isExisting || isSelected) && (
                                <p className="text-[10px] font-bold text-forest-700">
                                  {isExisting ? "Sudah masuk" : "Dipilih"}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 capitalize text-gray-600">
                          {MATERIAL_CATEGORY_FILTERS.find(
                            (item) => item.value === material.category,
                          )?.label || material.category}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {material.unit}
                        </td>
                        <td className="py-3 pr-4 text-gray-700">
                          Rp{" "}
                          {Number(material.standard_price || 0).toLocaleString(
                            "id-ID",
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700">
                              {material.availability?.qty_available ?? "-"}{" "}
                              {material.unit}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                stockStatus === "available"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : stockStatus === "low_stock"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {stockStatus === "available"
                                ? "Tersedia"
                                : stockStatus === "low_stock"
                                  ? "Stok Menipis"
                                  : "Info"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleMaterialSelection(material.id)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                              isExisting
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : isSelected
                                  ? "bg-forest-100 text-forest-800"
                                  : "bg-forest-800 text-white hover:bg-forest-900"
                            }`}
                          >
                            {isExisting
                              ? "Hapus"
                              : isSelected
                                ? "Batal"
                                : "+ Tambah"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRawMaterials.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-sm text-gray-400"
                      >
                        Tidak ada bahan sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-gray-500">
                Menampilkan {filteredRawMaterials.length} bahan ?{" "}
                {selectedMaterialIds.length} dipilih
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(false)}
                  className="rounded-[16px] border border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={appendSelectedMaterials}
                  disabled={selectedMaterialIds.length === 0}
                  className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
                >
                  Tambahkan{" "}
                  {selectedMaterialIds.length > 0
                    ? `(${selectedMaterialIds.length})`
                    : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
