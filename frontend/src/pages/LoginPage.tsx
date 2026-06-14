import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import mbgFlowLogo from "../assets/svg/MBGflowlogo.svg";

const API = "http://localhost:3002/api/auth";

interface LoginPageProps {
  onLogin: (user: { username: string; role: string; nama: string }) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");
      localStorage.setItem("mbg_user", JSON.stringify(data.user));
      localStorage.setItem("mbg_token", data.token);
      onLogin(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(76,175,80,0.16),transparent_28%),linear-gradient(180deg,#f5f8f4_0%,#edf2ee_100%)]">
      <div className="grid min-h-screen w-full overflow-hidden lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="login-hero relative hidden overflow-hidden bg-forest-900 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(165,214,167,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_30%)]" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] bg-white ring-1 ring-white/20">
              <img
                src={mbgFlowLogo}
                alt="MBGflow"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-base font-bold">MBGflow</p>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Menu Planning Dashboard
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-white">
              Sistem Perencanaan & Gizi
            </h1>
            <p className="mt-4 text-white/80 text-lg leading-relaxed">
              Platform modern (SaaS-style) untuk Ahli Gizi dalam mengatur menu,
              memantau nutrisi, dan mengelola distribusi.
            </p>
          </div>

          <div className="relative z-10">{/* Minimal footer space */}</div>
        </motion.div>

        <div className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-8 lg:p-12 bg-transparent">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-[2.25rem] font-bold tracking-[-0.03em] text-forest-950">
                Selamat Datang
              </h2>
              <p className="mt-2 text-base text-forest-800/70">
                Silakan login sebagai{" "}
                <span className="font-semibold text-forest-800">Ahli Gizi</span>{" "}
                untuk melanjutkan.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-forest-900">
                  Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-600/60" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border-0 bg-white/60 py-4 pl-12 pr-4 text-sm text-forest-900 ring-1 ring-forest-900/10 placeholder:text-forest-900/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600 transition-all"
                    placeholder="Contoh: Jhon Doe"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-forest-900">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-600/60" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border-0 bg-white/60 py-4 pl-12 pr-12 text-sm text-forest-900 ring-1 ring-forest-900/10 placeholder:text-forest-900/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600 transition-all"
                    placeholder="Masukkan password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-forest-600/60 transition hover:text-forest-900"
                    aria-label="Lihat password"
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-semibold shadow-lg shadow-forest-600/20 transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                <span>{loading ? "Masuk..." : "Masuk ke MBGflow"}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
