import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  UtensilsCrossed,
  FlaskConical,
  Upload,
  Image as ImageIcon,
  X,
} from "lucide-react";
import {
  CalorieIcon,
  ProteinIcon,
  FatIcon,
  CarboIcon,
} from "./icons/NutrientIcons";
import type {
  Menu,
  MenuIngredient,
  MenuNutrition,
  MenuKategori,
} from "../types";

const API = "http://localhost:3002/api/menu";

const KATEGORIS: MenuKategori[] = ["Siswa", "Balita", "Ibu Hamil"];
const SATUANS = [
  "kg",
  "g",
  "liter",
  "ml",
  "butir",
  "buah",
  "lembar",
  "batang",
  "siung",
  "sdm",
  "sdt",
];

interface MenuFormProps {
  menuId: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const emptyIngredient: MenuIngredient = {
  nama_bahan: "",
  jumlah: 0,
  satuan: "kg",
};

const emptyNutrition: MenuNutrition = {
  kalori: 0,
  protein: 0,
  lemak: 0,
  karbohidrat: 0,
  serat: 0,
};

export default function MenuForm({
  menuId,
  onSuccess,
  onCancel,
}: MenuFormProps) {
  const isEditing = menuId !== null;

  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState<MenuKategori>("Siswa");
  const [deskripsi, setDeskripsi] = useState("");
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([
    { ...emptyIngredient },
  ]);
  const [nutrition, setNutrition] = useState<MenuNutrition>({
    ...emptyNutrition,
  });

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch existing data if editing
  useEffect(() => {
    if (isEditing && menuId) {
      setFetchingData(true);
      fetch(`${API}/${menuId}`)
        .then((res) => res.json())
        .then((data: Menu) => {
          setNama(data.nama);
          setKategori(data.kategori);
          setDeskripsi(data.deskripsi || "");
          if (data.gambar_url) {
            setExistingImage(data.gambar_url);
            setImagePreview(data.gambar_url);
          }
          if (data.ingredients && data.ingredients.length > 0) {
            setIngredients(
              data.ingredients.map((ing) => ({
                nama_bahan: ing.nama_bahan,
                jumlah: ing.jumlah,
                satuan: ing.satuan,
                bahan_baku_ref_id: ing.bahan_baku_ref_id,
              })),
            );
          }
          if (data.nutrition) {
            setNutrition({
              kalori: data.nutrition.kalori,
              protein: data.nutrition.protein,
              lemak: data.nutrition.lemak,
              karbohidrat: data.nutrition.karbohidrat,
              serat: data.nutrition.serat,
            });
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setFetchingData(false));
    }
  }, [menuId, isEditing]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, WebP, GIF)");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB");
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async (targetMenuId: number) => {
    if (!imageFile) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const res = await fetch(`${API}/${targetMenuId}/upload-image`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal upload gambar");
      }

      setImageFile(null);
      setExistingImage(data.gambar_url);
      setSuccess("Gambar berhasil diupload!");
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal upload gambar");
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!menuId || !existingImage) return;

    if (!confirm("Hapus gambar menu?")) return;

    try {
      const res = await fetch(`${API}/${menuId}/image`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Gagal menghapus gambar");
      }

      setExistingImage(null);
      setImagePreview(null);
      setSuccess("Gambar berhasil dihapus");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal menghapus gambar");
      }
    }
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { ...emptyIngredient }]);
  };

  const handleRemoveIngredient = (index: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (
    index: number,
    field: keyof MenuIngredient,
    value: string | number,
  ) => {
    const updated = [...ingredients];
    (updated[index] as unknown as Record<string, unknown>)[field] = value;
    setIngredients(updated);
  };

  const handleNutritionChange = (field: keyof MenuNutrition, value: number) => {
    setNutrition({ ...nutrition, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate ingredients
    const validIngredients = ingredients.filter(
      (ing) => ing.nama_bahan.trim() !== "",
    );
    if (validIngredients.length === 0) {
      setError("Minimal satu bahan baku harus diisi.");
      setLoading(false);
      return;
    }

    const payload = {
      nama,
      kategori,
      deskripsi: deskripsi || null,
      ingredients: validIngredients,
      nutrition,
    };

    try {
      const url = isEditing ? `${API}/${menuId}` : API;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Terjadi kesalahan");
      }

      // If creating new menu and there's an image to upload
      if (!isEditing && imageFile && data.data?.id) {
        await handleUploadImage(data.data.id);
      }

      setSuccess(
        isEditing ? "Menu berhasil diperbarui!" : "Menu berhasil dibuat!",
      );
      setTimeout(() => onSuccess(), 1200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal menghubungi server");
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onCancel}
        className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Kembali ke Daftar Menu</span>
      </button>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Info Menu */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <UtensilsCrossed className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {isEditing ? "Edit Menu" : "Buat Menu Baru"}
              </h2>
              <p className="text-sm text-slate-500">
                Isi informasi dasar menu makanan
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Nama Menu *
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Misal: Nasi Goreng Ayam Spesial"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Kategori *
              </label>
              <select
                required
                value={kategori}
                onChange={(e) => setKategori(e.target.value as MenuKategori)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              >
                {KATEGORIS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Deskripsi
              </label>
              <textarea
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Deskripsi singkat tentang menu..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 1.5: Upload Gambar Menu - AVAILABLE FOR BOTH CREATE AND EDIT */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-violet-100 rounded-xl">
              <ImageIcon className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Gambar Menu</h2>
              <p className="text-sm text-slate-500">
                {isEditing
                  ? "Ganti atau tambahkan foto menu (JPG, PNG, WebP, GIF - Max 5MB)"
                  : "Tambahkan foto menu (akan diupload setelah menu tersimpan)"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Preview */}
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-48 h-48 object-cover rounded-xl border-2 border-violet-200 shadow-md"
                />
                {existingImage && !imageFile && (
                  <span className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                    ✓ Tersimpan
                  </span>
                )}
                {imageFile && (
                  <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                    ⏳ Belum disimpan
                  </span>
                )}
                {/* Remove preview button */}
                {imageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(existingImage);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-emerald-700 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* File Input */}
            <div>
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-violet-300 rounded-xl p-6 text-center hover:border-violet-500 hover:bg-violet-50 transition-all">
                  <Upload className="h-8 w-8 text-violet-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">
                    {imagePreview
                      ? "Klik untuk mengganti gambar"
                      : "Klik untuk upload gambar"}
                  </p>
                  <p className="text-xs text-slate-500">
                    JPG, PNG, WebP, GIF — Maksimal 5MB
                  </p>
                </div>
              </label>
            </div>

            {/* Upload button for editing mode (immediate upload) */}
            {isEditing && imageFile && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => menuId && handleUploadImage(menuId)}
                  disabled={uploadingImage}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {uploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload Gambar Sekarang</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(existingImage);
                  }}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
              </div>
            )}

            {/* For create mode - info message */}
            {!isEditing && imageFile && (
              <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl">
                <ImageIcon className="h-4 w-4 text-violet-600 shrink-0" />
                <p className="text-xs text-violet-700 font-medium">
                  Gambar akan otomatis diupload saat menu disimpan.
                </p>
              </div>
            )}

            {/* Delete image button */}
            {isEditing && existingImage && !imageFile && (
              <button
                type="button"
                onClick={handleDeleteImage}
                className="w-full px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold rounded-xl transition-colors border border-rose-200"
              >
                🗑️ Hapus Gambar
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Bahan Baku (Dynamic Form) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-100 rounded-xl">
                <FlaskConical className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Bahan Baku</h2>
                <p className="text-sm text-slate-500">
                  Tambahkan bahan baku dan jumlah per porsi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddIngredient}
              className="flex items-center space-x-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah</span>
            </button>
          </div>

          <div className="space-y-3">
            {ingredients.map((ing, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-3 items-end bg-slate-50 rounded-xl p-4 border border-slate-100"
              >
                <div className="col-span-12 md:col-span-5 space-y-1">
                  {idx === 0 && (
                    <label className="text-xs font-semibold text-slate-500">
                      Nama Bahan
                    </label>
                  )}
                  <input
                    type="text"
                    required
                    value={ing.nama_bahan}
                    onChange={(e) =>
                      handleIngredientChange(idx, "nama_bahan", e.target.value)
                    }
                    placeholder="Misal: Daging Ayam"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                  />
                </div>
                <div className="col-span-5 md:col-span-3 space-y-1">
                  {idx === 0 && (
                    <label className="text-xs font-semibold text-slate-500">
                      Jumlah
                    </label>
                  )}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={ing.jumlah || ""}
                    onChange={(e) =>
                      handleIngredientChange(
                        idx,
                        "jumlah",
                        Number(e.target.value),
                      )
                    }
                    placeholder="0.15"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                  />
                </div>
                <div className="col-span-5 md:col-span-3 space-y-1">
                  {idx === 0 && (
                    <label className="text-xs font-semibold text-slate-500">
                      Satuan
                    </label>
                  )}
                  <select
                    value={ing.satuan}
                    onChange={(e) =>
                      handleIngredientChange(idx, "satuan", e.target.value)
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                  >
                    {SATUANS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(idx)}
                    disabled={ingredients.length <= 1}
                    className={`p-2.5 rounded-lg transition-colors ${
                      ingredients.length <= 1
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Data Gizi */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <FlaskConical className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Data Gizi per Porsi
              </h2>
              <p className="text-sm text-slate-500">
                Masukkan komposisi gizi untuk analisis AI
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                key: "kalori" as const,
                label: "Kalori",
                unit: "kkal",
                color: "focus:ring-orange-500",
                icon: <CalorieIcon className="h-4 w-4" />,
              },
              {
                key: "protein" as const,
                label: "Protein",
                unit: "g",
                color: "focus:ring-blue-500",
                icon: <ProteinIcon className="h-4 w-4" />,
              },
              {
                key: "lemak" as const,
                label: "Lemak",
                unit: "g",
                color: "focus:ring-rose-500",
                icon: <FatIcon className="h-4 w-4" />,
              },
              {
                key: "karbohidrat" as const,
                label: "Karbohidrat",
                unit: "g",
                color: "focus:ring-amber-500",
                icon: <CarboIcon className="h-4 w-4" />,
              },
              {
                key: "serat" as const,
                label: "Serat",
                unit: "g",
                color: "focus:ring-green-500",
                icon: "🥬",
              },
            ].map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>{field.icon}</span>
                  {field.label} ({field.unit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={nutrition[field.key] || ""}
                  onChange={(e) =>
                    handleNutritionChange(field.key, Number(e.target.value))
                  }
                  placeholder="0"
                  className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 ${field.color} focus:border-transparent outline-none transition-all`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-start space-x-3 border border-emerald-200">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center space-x-3 border border-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium bg-white hover:bg-slate-50 transition-all text-center"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`flex-[2] py-3.5 px-4 rounded-xl text-white font-medium flex justify-center items-center transition-all ${
              loading
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg"
            }`}
          >
            {loading
              ? "Menyimpan..."
              : isEditing
                ? "Perbarui Menu"
                : "Simpan Menu Baru"}
          </button>
        </div>
      </form>
    </div>
  );
}
