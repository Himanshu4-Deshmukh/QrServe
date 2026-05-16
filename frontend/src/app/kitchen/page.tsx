"use client";
import { useEffect, useState } from "react";
import { getOrders, updateOrderStatus } from "@/lib/api";
import { joinKitchen, startConnection } from "@/lib/signalr";
import { playOrderNotificationSound, unlockNotificationSound } from "@/lib/notificationSound";
import { Order, OrderStatus } from "@/types";
import { ChefHat, Clock, XCircle, ArrowLeft, RefreshCw, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

const statusColors: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  Preparing: "bg-purple-100 text-purple-700 border-purple-200",
  Ready: "bg-green-100 text-green-700 border-green-200",
  Served: "bg-gray-100 text-gray-700 border-gray-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};
const nextStatus: Record<string, OrderStatus> = { Pending: "Confirmed", Confirmed: "Preparing", Preparing: "Ready", Ready: "Served", Served: "Completed" };
const nextLabel: Record<string, string> = { Pending: "Accept Order", Confirmed: "Start Preparing", Preparing: "Mark Ready", Ready: "Mark Served", Served: "Complete" };

function KitchenContent() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");

  const loadOrders = async () => { setLoading(true); try { setOrders(await getOrders()); } catch (e) { console.error(e); } finally { setLoading(false); } };

  useEffect(() => {
    loadOrders();

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
        conn.on("NewOrder", (order: Order) => {
          playOrderNotificationSound().catch(() => {});
          setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [order, ...prev]));
        });
        conn.on("OrderStatusUpdated", (update: { id: string; status: string }) =>
          setOrders((prev) => prev.map((o) => (o.id === update.id ? { ...o, status: update.status as OrderStatus } : o))));
      } catch (e) { console.error("SignalR:", e); }
    })();

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const handleStatus = async (orderId: string, status: OrderStatus) => {
    try { await updateOrderStatus(orderId, status); setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o))); }
    catch (e: any) { toast(e?.message || "Failed to update status", "error"); }
  };

  const handleLogout = () => { logout(); router.push("/login?redirect=/kitchen"); };

  const filtered = orders.filter((o) => filter === "active" ? !["Completed", "Cancelled"].includes(o.status) : o.status === filter);
  const timeSince = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? "Just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`; };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-30 bg-gray-900/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="p-2 hover:bg-gray-800 rounded-xl"><ArrowLeft className="w-5 h-5" /></button>
            <ChefHat className="w-6 h-6 text-brand-400" /><h1 className="text-xl font-bold">Kitchen Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
            {user && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">
                👤 {user.fullName}
              </span>
            )}
            <button onClick={loadOrders} className="p-2 hover:bg-gray-800 rounded-xl"><RefreshCw className="w-5 h-5" /></button>
            <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded-xl text-red-400" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {["active", "Pending", "Confirmed", "Preparing", "Ready", "Served"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${filter === f ? "bg-brand-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {f === "active" ? "Active" : f}
            </button>
          ))}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" /></div>
        : filtered.length === 0 ? <div className="text-center py-20 text-gray-500"><ChefHat className="w-16 h-16 mx-auto mb-4 opacity-30" /><p className="text-lg">No orders</p></div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((order) => (
              <div key={order.id} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">#{order.orderNumber}</span>
                      <span className={`badge border ${statusColors[order.status]}`}>{order.status}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">Table {order.tableNumber} · {timeSince(order.createdAt)}</p>
                  </div>
                  <Clock className="w-5 h-5 text-gray-500" />
                </div>
                <div className="p-4 space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <div>
                        <span className="font-medium text-brand-300 mr-2">{item.quantity}x</span><span>{item.menuItemName}</span>
                        {item.specialInstructions && <p className="text-xs text-yellow-400 mt-0.5">⚠ {item.specialInstructions}</p>}
                      </div>
                    </div>
                  ))}
                  {order.notes && <div className="mt-2 p-2 bg-gray-700/50 rounded-lg text-xs text-gray-300">📝 {order.notes}</div>}
                </div>
                <div className="p-4 border-t border-gray-700 flex gap-2">
                  {nextStatus[order.status] && <button onClick={() => handleStatus(order.id, nextStatus[order.status])} className="btn-primary flex-1 text-sm py-2">{nextLabel[order.status]}</button>}
                  {order.status === "Pending" && <button onClick={() => handleStatus(order.id, "Cancelled")} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition text-sm"><XCircle className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function KitchenPage() {
  return (
    <ProtectedRoute allowedRoles={["Admin", "Kitchen"]}>
      <KitchenContent />
    </ProtectedRoute>
  );
}
