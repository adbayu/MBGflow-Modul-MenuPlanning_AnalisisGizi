// ============================================================
// Types — Menu Planning & Analisis Gizi (Updated)
// ============================================================

export interface MenuIngredient {
  id?: number;
  menu_id?: number;
  bahan_baku_ref_id?: number | null;
  nama_bahan: string;
  jumlah: number;
  satuan: string;
  harga_satuan?: number; // harga per satuan (Rp/kg atau Rp/liter)
  subtotal?: number; // calculated: jumlah * harga_satuan (adjusted)
}

export interface MenuNutrition {
  id?: number;
  menu_id?: number;
  kalori: number;
  protein: number;
  lemak: number;
  karbohidrat: number;
  serat: number;
  gula: number;
  vitamins?: number; // % of daily value
}

export interface ManualMacronutrient {
  id?: number;
  menu_id?: number;
  nama: string;
  nilai: number;
  satuan: string;
}

export type MenuKategori = "Siswa" | "Balita" | "Ibu Hamil";

export interface Menu {
  id: number;
  nama: string;
  kategori: MenuKategori;
  deskripsi: string | null;
  gambar_url: string | null;
  harga_jual: number;
  is_active: number;
  is_substituted?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  kalori?: number;
  protein?: number;
  lemak?: number;
  karbohidrat?: number;
  serat?: number;
  gula?: number;
  // Calculated
  hpp?: number;
  profit_pct?: number;
  // Detailed
  ingredients?: MenuIngredient[];
  nutrition?: MenuNutrition | null;
  manual_macronutrients?: ManualMacronutrient[];
}

export interface NutrientAnalysis {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  target?: number | null;
  percent?: number | null;
  status: string;
  score: number;
  category?: "macro" | "micro";
  limit_only?: boolean;
}

export interface AIRecommendation {
  jenis: string;
  nutrient: string | null;
  severity: "success" | "warning" | "danger";
  pesan: string;
  detail: string | null;
}

export interface AIAnalysisResult {
  menu_nama: string;
  skor_gizi: number;
  status: string;
  pesan: string;
  catatan_ai?: string;
  tips_ai?: string;
  kesimpulan_ai?: string;
  detail_analisis: Record<string, NutrientAnalysis>;
  rekomendasi: AIRecommendation[];
  standar_referensi: string;
  target_key?: string;
  target_label?: string;
  target_focus?: string;
  menu_role?: "main_menu" | "drink" | "support_drink";
  macro_distribution?: {
    protein_pct: number;
    karbohidrat_pct: number;
    lemak_pct: number;
  } | null;
  data_quality?: {
    is_complete: boolean;
    warnings: string[];
  };
  ai_engine: string;
  analyzed_at: string;
}

export interface MenuStats {
  total_menus: number;
  active_menus: number;
  avg_nutrition: {
    avg_kalori: number;
    avg_protein: number;
    avg_lemak: number;
    avg_karbohidrat: number;
  };
  per_kategori: Array<{ kategori: string; count: number }>;
}

export type KelompokSasaran = "balita" | "siswa" | "ibu_hamil";

export interface GroupTargetNutrisi {
  id: KelompokSasaran;
  label: string;
  sublabel: string;
  icon: string;
  kalori_min: number;
  kalori_max: number;
  protein: number;
  karbo: number;
  lemak: number;
  serat: number;
  // Khusus ibu hamil
  fe?: number;
  ca?: number;
  folat?: number;
}

export interface HPPGroup {
  group: string;
  label: string;
  sublabel: string;
  kalori_target: string;
  hpp_per_porsi: number;
  ingredients: Array<MenuIngredient & { subtotal: number }>;
  anggaran: {
    bulan: number;
    terpakai: number;
    stok_gudang_pct: number;
    prediksi_hari: number;
    bottleneck: string;
    bottleneck_sisa: string;
  };
}

export interface GeneratedMenu {
  nama_menu: string;
  deskripsi: string;
  metode_masak: string;
  estimasi_gizi: {
    kalori: number;
    protein: number;
    lemak: number;
    karbohidrat: number;
    serat: number;
    gula: number;
  };
  bahan_digunakan: Array<{
    nama: string;
    jumlah: number;
    satuan: string;
    catatan?: string;
  }>;
  bahan_kurang: Array<{
    nama: string;
    jumlah_butuh: number;
    satuan: string;
    alasan: string;
  }>;
  tips_gizi: string;
  sesuai_target: boolean;
  kelompok: string;
  kategori: string;
  generated_at: string;
}

export type PageView =
  | "dashboard"
  | "weekly-schedule"
  | "menu-catalog"
  | "recipe-builder"
  | "ai-lab"
  | "smart-stock"
  | "financial";

export interface AuthUser {
  id?: number;
  username: string;
  role: string;
  nama: string;
}
