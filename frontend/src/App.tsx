import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, MoonStar, Search, SunMedium } from "lucide-react";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import WeeklySchedulePage from "./pages/WeeklySchedulePage";
import MenuCatalogPage from "./pages/MenuCatalogPage";
import RecipeBuilderPage from "./pages/RecipeBuilderPage";
import AILabPage from "./pages/AILabPage";
import type { PageView, AuthUser } from "./types";

function SmartStockPage() {
  return (
    <div className="page-shell">
      <div className="card p-8 sm:p-10">
        <div className="surface-muted flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="soft-badge">Coming Soon</span>
          <div>
            <h2 className="page-title text-[2rem]">Smart Stock</h2>
            <p className="page-subtitle max-w-xl">
              Halaman ini tetap dipertahankan, namun tampilannya sudah
              diselaraskan dengan dashboard baru sambil menunggu fitur stok
              dirilis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_META: Record<
  Exclude<PageView, "financial">,
  { label: string; description: string }
> = {
  dashboard: {
    label: "Dashboard",
    description:
      "Ringkasan operasional menu, status nutrisi, dan rencana mingguan.",
  },
  "weekly-schedule": {
    label: "Jadwal Mingguan",
    description:
      "Kelola jadwal mingguan dan assignment menu per hari untuk tiap lokasi distribusi.",
  },
  "menu-catalog": {
    label: "Menu Catalog",
    description:
      "Kelola seluruh katalog menu dalam tampilan yang lebih rapi dan profesional.",
  },
  "recipe-builder": {
    label: "Recipe Builder",
    description:
      "Form tambah dan edit menu dengan panel kerja yang lebih lega dan fokus.",
  },
  "ai-lab": {
    label: "AI Nutrition Lab",
    description:
      "Analitik AI dengan presentasi data yang lebih bersih dan mudah dibaca.",
  },
  "smart-stock": {
    label: "Smart Stock",
    description: "Placeholder modul stok dengan visual yang tetap konsisten.",
  },
};

interface TopbarProps {
  activePage: PageView;
  user: AuthUser;
  isNightMode: boolean;
  onToggleTheme: () => void;
}

function AppTopbar({
  activePage,
  user,
  isNightMode,
  onToggleTheme,
}: TopbarProps) {
  const meta = PAGE_META[activePage as Exclude<PageView, "financial">];

  return (
    <header className="glass-topbar card sticky top-3 z-20 rounded-[30px] px-4 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div>
            <h1 className="text-[1.55rem] font-bold tracking-[-0.03em] text-ink-700">
              {meta.label}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-400">
              {meta.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-65">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              readOnly
              value=""
              placeholder="Cari halaman, menu, atau insight"
              className="w-full border-white/60 bg-white/88 py-3 pl-11 pr-4 text-sm shadow-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-ink-500 shadow-sm transition hover:-translate-y-0.5 hover:text-forest-900"
              aria-label="Notifikasi"
            >
              <Bell className="h-4.5 w-4.5" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-ink-500 shadow-sm transition hover:-translate-y-0.5 hover:text-forest-900"
              aria-label={
                isNightMode ? "Aktifkan mode terang" : "Aktifkan night mode"
              }
              title={
                isNightMode ? "Aktifkan mode terang" : "Aktifkan night mode"
              }
            >
              {isNightMode ? (
                <SunMedium className="h-4.5 w-4.5" />
              ) : (
                <MoonStar className="h-4.5 w-4.5" />
              )}
            </button>

            <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/92 px-3 py-2 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-forest-900 to-forest-700 text-sm font-bold text-white">
                {(user.nama || user.username).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-700">
                  {user.nama || user.username}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-400">
                  {user.role || "Ahli Gizi"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activePage, setActivePage] = useState<PageView>("dashboard");
  const [isNightMode, setIsNightMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("mbg_theme_mode");
    const nightMode = savedTheme === "night";
    setIsNightMode(nightMode);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("night-mode", isNightMode);
    document.body.classList.toggle("night-mode", isNightMode);
    document.documentElement.setAttribute(
      "data-theme",
      isNightMode ? "night" : "day",
    );
    localStorage.setItem("mbg_theme_mode", isNightMode ? "night" : "day");
  }, [isNightMode]);

  useEffect(() => {
    const savedUser = localStorage.getItem("mbg_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("mbg_user");
      }
    }
  }, []);

  const handleLogin = (loggedInUser: AuthUser) => {
    setUser(loggedInUser);
    setActivePage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("mbg_user");
    localStorage.removeItem("mbg_token");
    setUser(null);
    setActivePage("dashboard");
  };

  const toggleTheme = () => {
    setIsNightMode((prev) => !prev);
  };

  const renderedPage = useMemo(() => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage onNavigate={setActivePage} />;
      case "weekly-schedule":
        return <WeeklySchedulePage onNavigate={setActivePage} />;
      case "menu-catalog":
        return <MenuCatalogPage onNavigate={setActivePage} />;
      case "recipe-builder":
        return <RecipeBuilderPage onNavigate={setActivePage} />;
      case "ai-lab":
        return <AILabPage />;
      case "smart-stock":
        return <SmartStockPage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  }, [activePage]);

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-430 flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:gap-5 lg:px-5 lg:py-5">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={handleLogout}
          user={user}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <AppTopbar
            activePage={activePage}
            user={user}
            isNightMode={isNightMode}
            onToggleTheme={toggleTheme}
          />

          <main className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="min-h-full"
              >
                {renderedPage}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
