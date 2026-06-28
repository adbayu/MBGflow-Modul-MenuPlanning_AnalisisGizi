const rawApiBaseUrl = import.meta.env.VITE_MENU_API_BASE_URL || "http://localhost:3002";

export const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, "");
export const MENU_API_URL = `${API_BASE_URL}/api/menu`;
export const AUTH_API_URL = `${API_BASE_URL}/api/auth`;
