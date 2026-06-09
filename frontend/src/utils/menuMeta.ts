import type { AIAnalysisResult, Menu } from "../types";

export type MenuType = "makanan" | "minuman";
export type MenuPorsi = "porsi_besar" | "porsi_kecil";

export interface MenuMetaEntry {
  type: MenuType;
  porsi: MenuPorsi;
  updatedAt: string;
}

export interface MenuEditLogEntry {
  id: string;
  menuId: number;
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export const MENU_META_STORAGE_KEY = "mbg_menu_meta_v1";
export const AI_ANALYSIS_CACHE_STORAGE_KEY = "mbg_ai_analysis_cache_v2";
export const MENU_EDIT_TARGET_STORAGE_KEY = "mbg_edit_menu_id_v1";
export const MENU_EDIT_LOG_STORAGE_KEY = "mbg_menu_edit_logs_v1";

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function sanitizeMenuName(name: string | null | undefined) {
  if (!name) return "";
  let current = name.trim();
  const suffixPattern =
    /\s*-\s*(siswa|balita|ibu\s*hamil|porsi\s*besar|porsi\s*kecil|minuman|makanan)\s*$/i;

  let previous = "";
  while (previous !== current) {
    previous = current;
    current = current.replace(suffixPattern, "").trim();
  }

  return current;
}

export function inferMenuType(
  menu: Pick<Menu, "nama" | "deskripsi">,
): MenuType {
  const text = `${menu.nama} ${menu.deskripsi || ""}`.toLowerCase();
  const drinkKeywords = [
    "minum",
    "minuman",
    "jus",
    "teh",
    "susu",
    "kopi",
    "sirup",
    "es ",
    "smoothie",
    "wedang",
    "infused",
  ];

  return drinkKeywords.some((k) => text.includes(k)) ? "minuman" : "makanan";
}

export function inferMenuPorsi(kalori: number | null | undefined): MenuPorsi {
  return Number(kalori || 0) >= 600 ? "porsi_besar" : "porsi_kecil";
}

export function getPorsiLabel(porsi: MenuPorsi) {
  return porsi === "porsi_besar" ? "Porsi Besar" : "Porsi Kecil";
}

export function loadMenuMetaMap(): Record<number, MenuMetaEntry> {
  const parsed = safeReadJson<Record<string, Partial<MenuMetaEntry>>>(
    MENU_META_STORAGE_KEY,
    {},
  );

  const normalized: Record<number, MenuMetaEntry> = {};
  Object.entries(parsed).forEach(([key, value]) => {
    const menuId = Number(key);
    if (!Number.isFinite(menuId)) return;

    const type = value?.type;
    const porsi = value?.porsi;
    if (
      (type === "makanan" || type === "minuman") &&
      (porsi === "porsi_besar" || porsi === "porsi_kecil")
    ) {
      normalized[menuId] = {
        type,
        porsi,
        updatedAt: value.updatedAt || new Date().toISOString(),
      };
    }
  });

  return normalized;
}

export function saveMenuMetaMap(metaMap: Record<number, MenuMetaEntry>) {
  safeWriteJson(MENU_META_STORAGE_KEY, metaMap);
}

export function setMenuMeta(
  menuId: number,
  partial: Partial<Omit<MenuMetaEntry, "updatedAt">>,
) {
  const current = loadMenuMetaMap();
  const existing = current[menuId];

  const nextType = partial.type || existing?.type || "makanan";
  const nextPorsi = partial.porsi || existing?.porsi || "porsi_kecil";

  current[menuId] = {
    type: nextType,
    porsi: nextPorsi,
    updatedAt: new Date().toISOString(),
  };

  saveMenuMetaMap(current);
  return current[menuId];
}

export function resolveMenuType(
  menu: Menu,
  metaMap?: Record<number, MenuMetaEntry>,
) {
  const source = metaMap || loadMenuMetaMap();
  return source[menu.id]?.type || inferMenuType(menu);
}

export function resolveMenuPorsi(
  menu: Menu,
  metaMap?: Record<number, MenuMetaEntry>,
) {
  const source = metaMap || loadMenuMetaMap();
  return source[menu.id]?.porsi || inferMenuPorsi(menu.kalori);
}

export function setEditTargetMenuId(menuId: number) {
  localStorage.setItem(MENU_EDIT_TARGET_STORAGE_KEY, String(menuId));
}

export function getEditTargetMenuId() {
  const raw = localStorage.getItem(MENU_EDIT_TARGET_STORAGE_KEY);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function clearEditTargetMenuId() {
  localStorage.removeItem(MENU_EDIT_TARGET_STORAGE_KEY);
}

export function loadAiAnalysisCache() {
  return safeReadJson<Record<string, AIAnalysisResult>>(
    AI_ANALYSIS_CACHE_STORAGE_KEY,
    {},
  );
}

export function getCachedAnalysis(menuId: number) {
  const cache = loadAiAnalysisCache();
  return cache[String(menuId)] || null;
}

export function setCachedAnalysis(menuId: number, result: AIAnalysisResult) {
  const cache = loadAiAnalysisCache();
  cache[String(menuId)] = result;
  safeWriteJson(AI_ANALYSIS_CACHE_STORAGE_KEY, cache);
}

export function hasCachedAnalysis(menuId: number) {
  return Boolean(getCachedAnalysis(menuId));
}

export function loadMenuEditLogs() {
  return safeReadJson<Record<string, MenuEditLogEntry[]>>(
    MENU_EDIT_LOG_STORAGE_KEY,
    {},
  );
}

export function getMenuEditLogs(menuId: number) {
  const logs = loadMenuEditLogs();
  const items = logs[String(menuId)] || [];
  return [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function appendMenuEditLogs(
  menuId: number,
  entries: MenuEditLogEntry[],
) {
  if (entries.length === 0) return;

  const logs = loadMenuEditLogs();
  const key = String(menuId);
  const existing = logs[key] || [];
  logs[key] = [...entries, ...existing].slice(0, 50);
  safeWriteJson(MENU_EDIT_LOG_STORAGE_KEY, logs);
}

export function createMenuEditLogEntry(
  menuId: number,
  field: string,
  oldValue: string,
  newValue: string,
): MenuEditLogEntry {
  return {
    id: `${Date.now()}-${field}-${Math.round(Math.random() * 10000)}`,
    menuId,
    timestamp: new Date().toISOString(),
    field,
    oldValue,
    newValue,
  };
}
