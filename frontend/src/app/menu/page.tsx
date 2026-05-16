"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getCategories, getOrdersByTable, getTableByQr } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { getLastOrderId, saveTableQr } from "@/lib/orderSession";
import { Category, MenuItem } from "@/types";
import { ShoppingCart, Clock, Flame, Plus, Minus, Search, ClipboardList, ArrowLeft } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5139";

const tagColors: Record<string, string> = {
  spicy: "bg-red-100 text-red-700",
  vegetarian: "bg-green-100 text-green-700",
  vegan: "bg-emerald-100 text-emerald-700",
  "gluten-free": "bg-amber-100 text-amber-700",
};

function getFullImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${API_URL}${imageUrl}`;
}

export default function MenuPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qr = searchParams.get("qr") || "QS-TABLE-001";
  const { items, addItem, updateQuantity, totalItems, subtotal, setTable, tableNumber } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastOrderId, setLastOrderId] = useState("");
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  useEffect(() => {
    setLastOrderId(getLastOrderId());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [cats, table] = await Promise.all([getCategories(), getTableByQr(qr)]);
        setCategories(cats);
        setTable(table.id, table.tableNumber);
        saveTableQr(qr);
        const activeOrders = await getOrdersByTable(table.id);
        setActiveOrdersCount(activeOrders.length);
        if (cats.length > 0) setActiveCategory(cats[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [qr]);

  const getItemQty = (id: string) => items.find((i) => i.menuItem.id === id)?.quantity || 0;
  const filteredItems = categories
    .filter((c) => !activeCategory || c.id === activeCategory)
    .flatMap((c) => c.menuItems)
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-xl"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold">Menu</h1>
            {tableNumber && <p className="text-xs text-gray-500">Table {tableNumber}</p>}
          </div>
          <div className="flex items-center gap-2">
            {lastOrderId && (
              <button
                onClick={() => router.push(`/order/${lastOrderId}`)}
                className="btn-secondary text-sm flex items-center gap-2"
                aria-label="View order status"
                title="View order status"
              >
                <ClipboardList className="w-5 h-5" />
                Status{activeOrdersCount > 0 ? ` (${activeOrdersCount})` : ""}
              </button>
            )}
            <button onClick={() => router.push("/cart")} className="relative p-2 -mr-2 hover:bg-gray-100 rounded-xl">
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 text-white text-xs rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeCategory === cat.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {filteredItems.length === 0 && (
          <p className="text-center text-gray-400 py-12">No items found</p>
        )}
        {filteredItems.map((item) => {
          const qty = getItemQty(item.id);
          const imgSrc = getFullImageUrl(item.imageUrl);

          return (
            <div key={item.id} className="card flex gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                {imgSrc ? (
                  <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-2xl">
                    🍽️
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                  <span className="font-bold text-brand-600 whitespace-nowrap ml-2">
                    ${item.price.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" /> {item.preparationTime}min
                  </span>
                  {item.calories && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Flame className="w-3 h-3" /> {item.calories} cal
                    </span>
                  )}
                  {item.tags?.map((tag) => (
                    <span key={tag} className={`badge ${tagColors[tag] || "bg-gray-100 text-gray-600"}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {qty === 0 ? (
                    <button onClick={() => addItem(item)} className="btn-primary text-sm py-1.5 px-4">
                      <Plus className="w-4 h-4 inline mr-1" /> Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, qty - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-semibold w-6 text-center">{qty}</span>
                      <button
                        onClick={() => addItem(item)}
                        className="w-8 h-8 flex items-center justify-center bg-brand-500 text-white rounded-lg hover:bg-brand-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/80 backdrop-blur-lg border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => router.push("/cart")}
              className="btn-primary w-full flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {totalItems} item{totalItems > 1 ? "s" : ""}
              </span>
              <span>${subtotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
