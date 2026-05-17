"use client";
import React, { useRef, useState } from "react";
import { Category, MenuItem } from "@/types";
import { Plus, Trash2, X, Upload, ImagePlus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5139";

function fullImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

interface Props {
  categories: Category[];
  onCreateCategory: (data: { name: string; description: string | null; sortOrder: number }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onCreateItem: (data: {
    categoryId: string; name: string; description: string | null;
    price: number; preparationTime: number; calories: number | null; tags: null;
  }) => Promise<void>;
  onToggleItem: (item: MenuItem) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onImageUpload: (itemId: string, file: File) => Promise<void>;
  onImageDelete: (itemId: string) => Promise<void>;
}

export default function MenuTab({
  categories,
  onCreateCategory, onDeleteCategory, onCreateItem,
  onToggleItem, onDeleteItem,
  onImageUpload, onImageDelete,
}: Props) {
  const [showCatForm, setShowCatForm]   = useState(false);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [catForm, setCatForm]   = useState({ name: "", description: "", sortOrder: "0" });
  const [menuForm, setMenuForm] = useState({
    categoryId: "", name: "", description: "",
    price: "", preparationTime: "15", calories: "",
  });
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateCat = async () => {
    await onCreateCategory({
      name: catForm.name,
      description: catForm.description || null,
      sortOrder: parseInt(catForm.sortOrder) || 0,
    });
    setShowCatForm(false);
    setCatForm({ name: "", description: "", sortOrder: "0" });
  };

  const handleCreateItem = async () => {
    await onCreateItem({
      categoryId: menuForm.categoryId,
      name: menuForm.name,
      description: menuForm.description || null,
      price: parseFloat(menuForm.price),
      preparationTime: parseInt(menuForm.preparationTime) || 15,
      calories: menuForm.calories ? parseInt(menuForm.calories) : null,
      tags: null,
    });
    setShowMenuForm(false);
    setMenuForm({ categoryId: "", name: "", description: "", price: "", preparationTime: "15", calories: "" });
  };

  const triggerFileInput = (itemId: string) => {
    setActiveUploadId(itemId);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUploadId) {
      setUploadingImage(activeUploadId);
      try {
        await onImageUpload(activeUploadId, file);
      } finally {
        setUploadingImage(null);
        setActiveUploadId(null);
      }
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileSelected}
      />

      <div className="flex gap-2">
        <button onClick={() => setShowCatForm(true)} className="btn-secondary text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add Category
        </button>
        <button onClick={() => setShowMenuForm(true)} className="btn-primary text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {showCatForm && (
        <div className="card border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">New Category</h3>
            <button onClick={() => setShowCatForm(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Name" value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Description" value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Sort Order" type="number" value={catForm.sortOrder}
              onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <button onClick={handleCreateCat} className="btn-primary text-sm mt-3">Create</button>
        </div>
      )}

      {showMenuForm && (
        <div className="card border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">New Menu Item</h3>
            <button onClick={() => setShowMenuForm(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <select value={menuForm.categoryId}
              onChange={(e) => setMenuForm({ ...menuForm, categoryId: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Select Category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Name" value={menuForm.name}
              onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Price" type="number" step="0.01" value={menuForm.price}
              onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Description" value={menuForm.description}
              onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Prep Time (min)" type="number" value={menuForm.preparationTime}
              onChange={(e) => setMenuForm({ ...menuForm, preparationTime: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
            <input placeholder="Calories" type="number" value={menuForm.calories}
              onChange={(e) => setMenuForm({ ...menuForm, calories: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <button onClick={handleCreateItem} className="btn-primary text-sm mt-3">Create Item</button>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat.id} className="card">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-bold text-lg">{cat.name}</h3>
              <p className="text-sm text-gray-400">{cat.description}</p>
            </div>
            {confirmDeleteCategoryId === cat.id ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { onDeleteCategory(cat.id); setConfirmDeleteCategoryId(null); }}
                  className="p-1.5 bg-red-500 text-white rounded-lg text-xs"
                >Yes</button>
                <button
                  onClick={() => setConfirmDeleteCategoryId(null)}
                  className="p-1.5 bg-gray-200 rounded-lg text-xs"
                >No</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteCategoryId(cat.id)}
                disabled={cat.menuItems.length > 0}
                className={`p-2 rounded-lg shrink-0 ${
                  cat.menuItems.length > 0
                    ? "text-gray-300 cursor-not-allowed"
                    : "hover:bg-red-50 text-red-400"
                }`}
                title={cat.menuItems.length > 0 ? "Delete the items in this category first" : "Delete category"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-3">
            {cat.menuItems.map((item) => {
              const imgSrc = fullImageUrl(item.imageUrl);
              return (
                <div key={item.id} className="flex items-center gap-4 py-3 px-4 bg-gray-50 rounded-xl">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 group/img">
                    {imgSrc ? (
                      <React.Fragment>
                        <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); triggerFileInput(item.id); }}
                            className="p-1 bg-white rounded-md hover:bg-gray-100" title="Change">
                            <Upload className="w-3 h-3 text-gray-700" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onImageDelete(item.id); }}
                            className="p-1 bg-white rounded-md hover:bg-red-50" title="Remove">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </React.Fragment>
                    ) : (
                      <button onClick={() => triggerFileInput(item.id)}
                        className="w-full h-full bg-gray-200 hover:bg-gray-300 transition flex flex-col items-center justify-center gap-0.5">
                        {uploadingImage === item.id ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-500" />
                        ) : (
                          <React.Fragment>
                            <ImagePlus className="w-5 h-5 text-gray-400" />
                            <span className="text-[9px] text-gray-400">Upload</span>
                          </React.Fragment>
                        )}
                      </button>
                    )}
                    {uploadingImage === item.id && imgSrc && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-sm text-gray-400">${item.price.toFixed(2)}</span>
                      {!item.isAvailable && (
                        <span className="badge bg-red-100 text-red-600">Unavailable</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onToggleItem(item)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${item.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}
                    >
                      {item.isAvailable ? "Available" : "Disabled"}
                    </button>

                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { onDeleteItem(item.id); setConfirmDeleteId(null); }}
                          className="p-1.5 bg-red-500 text-white rounded-lg text-xs"
                        >Yes</button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1.5 bg-gray-200 rounded-lg text-xs"
                        >No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {cat.menuItems.length === 0 && (
              <p className="text-sm text-gray-300 py-2">No items</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
