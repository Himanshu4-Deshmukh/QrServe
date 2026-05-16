"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrder, getOrdersByTable, getTable } from "@/lib/api";
import { startConnection, joinTable } from "@/lib/signalr";
import { Order, OrderStatus } from "@/types";
import { CheckCircle2, Clock, ChefHat, Bell, UtensilsCrossed, CreditCard, Check, ArrowLeft, ShoppingBag } from "lucide-react";
import { getTableQr, saveTableQr } from "@/lib/orderSession";

const statusSteps: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { status: "Pending", label: "Order Placed", icon: <Clock className="w-5 h-5" /> },
  { status: "Confirmed", label: "Confirmed", icon: <CheckCircle2 className="w-5 h-5" /> },
  { status: "Preparing", label: "Preparing", icon: <ChefHat className="w-5 h-5" /> },
  { status: "Ready", label: "Ready", icon: <Bell className="w-5 h-5" /> },
  { status: "Served", label: "Served", icon: <UtensilsCrossed className="w-5 h-5" /> },
];

const statusIndex = (s: OrderStatus) => statusSteps.findIndex((x) => x.status === s);

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [justUpdatedStep, setJustUpdatedStep] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [tableQr, setTableQr] = useState("");
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const lastStatusRef = useRef<string>("");
  const tableQrRef = useRef("");

  // Detect status change and trigger animation
  const handleStatusChange = (newStatus: string) => {
    if (lastStatusRef.current && lastStatusRef.current !== newStatus) {
      const idx = statusIndex(newStatus as OrderStatus);
      setJustUpdatedStep(idx);
      setTimeout(() => setJustUpdatedStep(null), 2500);
    }
    lastStatusRef.current = newStatus;
  };

  // Poll the API directly
  useEffect(() => {
    let mounted = true;
    let pollTimer: NodeJS.Timeout;

    const poll = async () => {
      try {
        const data = await getOrder(id);
        if (!mounted) return;
        handleStatusChange(data.status);
        setOrder(data);
        if (!tableQrRef.current) {
          const storedQr = getTableQr();
          if (storedQr) {
            tableQrRef.current = storedQr;
            setTableQr(storedQr);
          } else {
            try {
              const table = await getTable(data.tableId);
              if (!mounted) return;
              saveTableQr(table.qrCode);
              tableQrRef.current = table.qrCode;
              setTableQr(table.qrCode);
            } catch {
              // Best effort only.
            }
          }
        }

        try {
          const activeOrders = await getOrdersByTable(data.tableId);
          if (!mounted) return;
          setTableOrders(activeOrders);
        } catch (err) {
          console.error("Table order load failed:", err);
        }

        setLoading(false);
      } catch (e) {
        console.error("Poll failed:", e);
      }
    };

    // Initial fetch
    poll();

    // Poll every 3 seconds — guaranteed to work on any device
    pollTimer = setInterval(poll, 3000);

    return () => {
      mounted = false;
      clearInterval(pollTimer);
    };
  }, [id]);

  // Try SignalR for instant updates (bonus, not required)
  useEffect(() => {
    let mounted = true;

    const setupSignalR = async () => {
      if (!order) return;

      try {
        const conn = await startConnection();
        if (!mounted) return;

        await joinTable(order.tableId);
        setConnected(true);

        conn.off("OrderStatusUpdated");
        conn.on("OrderStatusUpdated", (update: { id: string; status: string }) => {
          if (!mounted) return;
          if (update.id === id) {
            console.log("SignalR update:", update.status);
            handleStatusChange(update.status);
            setOrder((prev) =>
              prev ? { ...prev, status: update.status as OrderStatus } : prev
            );
          }
        });
      } catch (e) {
        console.warn("SignalR unavailable, using polling:", e);
        if (mounted) setConnected(false);
      }
    };

    setupSignalR();

    return () => {
      mounted = false;
    };
  }, [order?.tableId, id]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
      </div>
    );

  if (!order)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-gray-700">Order not found</h2>
        <button onClick={() => window.history.back()} className="btn-primary mt-4">Go Back</button>
      </div>
    );

  const currentStep = statusIndex(order.status);
  const menuUrl = `/menu?qr=${encodeURIComponent(tableQr || getTableQr() || "QS-TABLE-001")}`;
  const activeTableOrders = tableOrders.filter((o) => !["Completed", "Cancelled"].includes(o.status));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(menuUrl)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-xl"
            aria-label="Back to menu"
            title="Back to menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold">Order #{order.orderNumber}</h1>
            <p className="text-xs text-gray-500">Table {order.tableNumber}</p>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${connected ? "bg-green-500" : "bg-yellow-500"}`}
              title={connected ? "Live" : "Polling"}
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Status Banner */}
        <div
          className={`rounded-2xl p-4 text-center transition-all duration-500 ${
            order.status === "Served" || order.status === "Completed"
              ? "bg-green-50 border border-green-200"
              : order.status === "Cancelled"
              ? "bg-red-50 border border-red-200"
              : "bg-brand-50 border border-brand-200"
          }`}
        >
          <p className="text-sm font-medium text-gray-500">Current Status</p>
          <p
            className={`text-2xl font-extrabold mt-1 ${
              order.status === "Served" || order.status === "Completed"
                ? "text-green-600"
                : order.status === "Cancelled"
                ? "text-red-600"
                : "text-brand-600"
            }`}
          >
            {order.status === "Preparing"
              ? "👨‍🍳 Preparing your food..."
              : order.status === "Ready"
              ? "🔔 Your order is ready!"
              : order.status === "Served"
              ? "🍽️ Enjoy your meal!"
              : order.status}
          </p>
          {order.status === "Ready" && (
            <p className="text-sm text-green-600 mt-1 animate-pulse font-medium">
              Your order is ready for pickup!
            </p>
          )}
          <p className="text-[10px] text-gray-400 mt-2">
            {connected ? "🟢 Live updates" : "🟡 Updating every 3s"}
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-6">Order Progress</h2>
          <div className="space-y-0">
            {statusSteps.map((step, i) => {
              const isComplete = i < currentStep;
              const isCurrent = i === currentStep;
              const wasJustUpdated = justUpdatedStep === i;

              return (
                <div
                  key={step.status}
                  className={`flex items-start gap-4 ${wasJustUpdated ? "animate-status-flash rounded-xl px-2 -mx-2" : ""}`}
                >
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {isCurrent && (
                        <div className="absolute inset-[-4px] rounded-full border-[3px] border-transparent border-t-brand-500 border-r-brand-500 animate-spin-border" />
                      )}
                      {wasJustUpdated && isComplete && (
                        <div className="absolute inset-[-6px] rounded-full animate-ring-pulse-green" />
                      )}
                      {isCurrent && (
                        <div className="absolute inset-[-6px] rounded-full animate-ring-pulse" />
                      )}
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 relative z-10 ${
                          isCurrent
                            ? "bg-brand-500 text-white shadow-lg"
                            : isComplete
                            ? "bg-green-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {isComplete ? (
                          <div className={wasJustUpdated ? "animate-check-pop" : ""}>
                            <Check className="w-5 h-5" strokeWidth={3} />
                          </div>
                        ) : (
                          step.icon
                        )}
                      </div>
                    </div>
                    {i < statusSteps.length - 1 && (
                      <div
                        className={`w-0.5 h-10 transition-all duration-700 ${
                          isComplete
                            ? "bg-gradient-to-b from-green-400 to-green-300"
                            : isCurrent
                            ? "bg-gradient-to-b from-brand-300 to-gray-200"
                            : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-2.5">
                    <p
                      className={`font-semibold transition-all duration-500 ${
                        isCurrent ? "text-brand-600 text-base" : isComplete ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" style={{ animationDelay: "0.15s" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" style={{ animationDelay: "0.3s" }} />
                        </span>
                      )}
                    </p>
                    {isComplete && wasJustUpdated && (
                      <p className="text-xs text-green-500 mt-0.5 animate-check-pop">✓ Done</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Items */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">Items</h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium">{item.menuItemName}</p>
                  <p className="text-sm text-gray-400">Qty: {item.quantity}</p>
                  {item.specialInstructions && (
                    <p className="text-xs text-gray-400 italic mt-0.5">&quot;{item.specialInstructions}&quot;</p>
                  )}
                </div>
                <span className="font-semibold">${(item.unitPrice * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-4 pt-4 space-y-1">
            <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Tax</span><span>${order.tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-lg pt-1"><span>Total</span><span className="text-brand-600">${order.total.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Payment Status */}
        <div className={`card border-2 transition-all duration-500 ${
  order.paymentStatus === "Paid"
    ? "border-green-200 bg-green-50"
    : "border-gray-100 bg-white"
}`}>
  <div className="flex items-center justify-between">
    <div>
      <p className="font-semibold text-gray-900">Payment</p>
      {order.paymentStatus === "Paid" ? (
        <div className="mt-1 space-y-1">
          <p className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Payment Complete
          </p>
          <p className="text-xs text-green-500">
            Paid via {order.paymentMethod} · Thank you!
          </p>
        </div>
      ) : (
        <div className="mt-1 space-y-1">
          <p className="text-sm text-yellow-600 font-medium flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Awaiting Payment
          </p>
          <p className="text-xs text-gray-400">
            Total due: <span className="font-semibold text-gray-700">${order.total.toFixed(2)}</span>
          </p>
        </div>
      )}
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
      order.paymentStatus === "Paid"
        ? "bg-green-100"
        : "bg-yellow-50"
    }`}>
      {order.paymentStatus === "Paid" ? (
        <CheckCircle2 className="w-6 h-6 text-green-500" />
      ) : (
        <CreditCard className="w-6 h-6 text-yellow-500" />
      )}
    </div>
        </div>

        {activeTableOrders.length > 1 && (
          <div className="card border-brand-200 bg-brand-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">Table Orders</h2>
                <p className="text-sm text-gray-500">
                  {activeTableOrders.length} active orders at this table
                </p>
              </div>
              <span className="badge bg-brand-100 text-brand-700">
                {activeTableOrders.length} Active
              </span>
            </div>
            <div className="space-y-3">
              {activeTableOrders.map((tableOrder) => {
                const isCurrent = tableOrder.id === order.id;
                return (
                  <div
                    key={tableOrder.id}
                    className={`rounded-xl border p-4 ${isCurrent ? "border-brand-300 bg-white" : "border-gray-200 bg-white/70"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          Order #{tableOrder.orderNumber}
                          {isCurrent && <span className="ml-2 text-xs text-brand-600">Current</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tableOrder.items.length} item{tableOrder.items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          tableOrder.status === "Ready"
                            ? "bg-green-100 text-green-700"
                            : tableOrder.status === "Preparing"
                            ? "bg-purple-100 text-purple-700"
                            : tableOrder.status === "Confirmed"
                            ? "bg-blue-100 text-blue-700"
                            : tableOrder.status === "Pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {tableOrder.status}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-between text-sm text-gray-500">
                      <span>Total</span>
                      <span className="font-semibold text-gray-900">${tableOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Payment Progress Bar */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`flex-1 h-2 rounded-full ${order.paymentStatus === "Paid" ? "bg-green-200" : "bg-gray-200"}`}>
              <div className={`h-2 rounded-full transition-all duration-1000 ${
                order.paymentStatus === "Paid" ? "bg-green-500 w-full" : "bg-yellow-400 w-1/3"
              }`} />
            </div>
            <span className={`text-xs font-semibold ${order.paymentStatus === "Paid" ? "text-green-600" : "text-yellow-600"}`}>
              {order.paymentStatus === "Paid" ? "Paid ✓" : "Unpaid"}
            </span>
          </div>
        </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => router.push(menuUrl)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Order More
          </button>
        </div>
      </main>
    </div>
  );
}
