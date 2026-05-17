"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  getDashboardAnalytics, getOrders, getTables, getCategories,
  createCategory, deleteCategory, createMenuItem, updateMenuItem, deleteMenuItem,
  updateOrderStatus, updatePayment, uploadMenuItemImage, deleteMenuItemImage, createTable, deleteTable,
} from "@/lib/api";
import {
  playOrderNotificationSound,
  stopAllOrderNotificationSounds,
  stopOrderNotificationSound,
  unlockNotificationSound,
} from "@/lib/notificationSound";
import { DashboardAnalytics, Order, MenuItem, Category, OrderStatus, RestaurantTable } from "@/types";
import { startConnection, joinKitchen } from "@/lib/signalr";
import { LayoutDashboard, ArrowLeft, ShoppingBag, UtensilsCrossed, Users, BarChart3, LogOut } from "lucide-react";

import DashboardTab from "./components/DashboardTab";
import OrdersTab    from "./components/OrdersTab";
import MenuTab      from "./components/MenuTab";
import TablesTab    from "./components/TablesTab";

type Tab = "dashboard" | "orders" | "menu" | "tables";

function AdminContent() {
  const router  = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [tab, setTab]             = useState<Tab>("dashboard");
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables]       = useState<RestaurantTable[]>([]);
  const [loading, setLoading]     = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [a, o, t, c] = await Promise.all([
        getDashboardAnalytics(), getOrders(), getTables(), getCategories(),
      ]);
      setAnalytics(a); setOrders(o); setTables(t); setCategories(c);
    } catch {
      toast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const refetchCategories = async () => {
    try {
      const c = await getCategories();
      setCategories(c);
    } catch {
      toast("Failed to reload menu", "error");
    }
  };

  const refetchTables = async () => {
    try {
      const t = await getTables();
      setTables(t);
    } catch {
      toast("Failed to reload tables", "error");
    }
  };

  useEffect(() => {
    loadAll();

    const unlock = () => {
      unlockNotificationSound().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    (async () => {
      try {
        const conn = await startConnection();
        await joinKitchen();

        conn.off("NewOrder");
        conn.off("OrderStatusUpdated");

        conn.on("NewOrder", (newOrder: Order) => {
          playOrderNotificationSound(newOrder.id).catch(() => {});
          setOrders((prev) => (prev.some((o) => o.id === newOrder.id) ? prev : [newOrder, ...prev]));
          getDashboardAnalytics().then(setAnalytics).catch(() => {});
          getTables().then(setTables).catch(() => {});
        });

        conn.on("OrderStatusUpdated", (update: { id: string; status: string }) => {
          if (update.status !== "Pending") stopOrderNotificationSound(update.id);
          setOrders((prev) =>
            prev.map((o) => o.id === update.id ? { ...o, status: update.status as OrderStatus } : o)
          );
          getDashboardAnalytics().then(setAnalytics).catch(() => {});
          getTables().then(setTables).catch(() => {});
        });
      } catch {
        // SignalR is best-effort; page still works without it
      }
    })();

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      stopAllOrderNotificationSounds();
    };
  }, []);

  useEffect(() => {
    orders.forEach((order) => {
      if (order.status === "Pending") {
        playOrderNotificationSound(order.id).catch(() => {});
      } else {
        stopOrderNotificationSound(order.id);
      }
    });
  }, [orders]);

  // ── Order handlers ──────────────────────────────────────────────────────────

  const handleStatusUpdate = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
      // Optimistic update — SignalR will also arrive and reconcile
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    } catch (e: any) {
      toast(e?.message || "Failed to update status", "error");
    }
  };

  const handlePayment = async (id: string, method: string) => {
    try {
      await updatePayment(id, "Paid", method);
      setOrders((prev) =>
        prev.map((o) => o.id === id ? { ...o, paymentStatus: "Paid", paymentMethod: method } : o)
      );
      toast("Payment recorded", "success");
    } catch {
      toast("Failed to record payment", "error");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await updateOrderStatus(id, "Cancelled");
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "Cancelled" } : o));
      toast("Order cancelled", "info");
    } catch (e: any) {
      toast(e?.message || "Failed to cancel order", "error");
    }
  };

  // ── Menu handlers ────────────────────────────────────────────────────────────

  const handleCreateCategory = async (data: { name: string; description: string | null; sortOrder: number }) => {
    try {
      await createCategory(data);
      await refetchCategories();
      toast("Category created", "success");
    } catch {
      toast("Failed to create category", "error");
    }
  };

  const handleCreateItem = async (data: any) => {
    try {
      await createMenuItem(data);
      await refetchCategories();
      toast("Item created", "success");
    } catch {
      toast("Failed to create item", "error");
    }
  };

  const handleToggleItem = async (item: MenuItem) => {
    try {
      await updateMenuItem(item.id, { isAvailable: !item.isAvailable });
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          menuItems: cat.menuItems.map((m) =>
            m.id === item.id ? { ...m, isAvailable: !m.isAvailable } : m
          ),
        }))
      );
    } catch {
      toast("Failed to update item", "error");
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteMenuItem(id);
      setCategories((prev) =>
        prev.map((cat) => ({ ...cat, menuItems: cat.menuItems.filter((m) => m.id !== id) }))
      );
      toast("Item deleted", "success");
    } catch {
      toast("Failed to delete item", "error");
    }
  };

  const handleImageUpload = async (itemId: string, file: File) => {
    try {
      const res = await uploadMenuItemImage(itemId, file);
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          menuItems: cat.menuItems.map((m) =>
            m.id === itemId ? { ...m, imageUrl: res.imageUrl } : m
          ),
        }))
      );
      toast("Image uploaded", "success");
    } catch {
      toast("Failed to upload image", "error");
    }
  };

  const handleImageDelete = async (itemId: string) => {
    try {
      await deleteMenuItemImage(itemId);
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          menuItems: cat.menuItems.map((m) =>
            m.id === itemId ? { ...m, imageUrl: null } : m
          ),
        }))
      );
      toast("Image removed", "info");
    } catch {
      toast("Failed to remove image", "error");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      toast("Category deleted", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to delete category", "error");
    }
  };

  const handleCreateTable = async (data: { tableNumber?: number; seats?: number }) => {
    try {
      await createTable(data);
      await refetchTables();
      toast("Table created", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to create table", "error");
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      await deleteTable(id);
      await refetchTables();
      toast("Table deleted", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to delete table", "error");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <BarChart3      className="w-4 h-4" /> },
    { key: "orders",    label: "Orders",    icon: <ShoppingBag    className="w-4 h-4" /> },
    { key: "menu",      label: "Menu",      icon: <UtensilsCrossed className="w-4 h-4" /> },
    { key: "tables",    label: "Tables",    icon: <Users          className="w-4 h-4" /> },
  ];

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="p-2 hover:bg-gray-100 rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <LayoutDashboard className="w-5 h-5 text-brand-500" />
            <h1 className="text-lg font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                👤 {user.fullName} ({user.role})
              </span>
            )}
            <button
              onClick={() => { logout(); router.push("/login?redirect=/admin"); }}
              className="p-2 hover:bg-red-50 rounded-xl text-red-400"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap
                ${tab === t.key ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "dashboard" && analytics && (
          <DashboardTab analytics={analytics} />
        )}
        {tab === "orders" && (
          <OrdersTab
            orders={orders}
            onStatusUpdate={handleStatusUpdate}
            onPayment={handlePayment}
            onCancel={handleCancel}
          />
        )}
        {tab === "menu" && (
          <MenuTab
            categories={categories}
            onCreateCategory={handleCreateCategory}
            onDeleteCategory={handleDeleteCategory}
            onCreateItem={handleCreateItem}
            onToggleItem={handleToggleItem}
            onDeleteItem={handleDeleteItem}
            onImageUpload={handleImageUpload}
            onImageDelete={handleImageDelete}
          />
        )}
        {tab === "tables" && (
          <TablesTab tables={tables} onCreateTable={handleCreateTable} onDeleteTable={handleDeleteTable} />
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["Admin"]}>
      <AdminContent />
    </ProtectedRoute>
  );
}
