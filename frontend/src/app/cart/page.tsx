"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { createOrder } from "@/lib/api";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, MessageSquare } from "lucide-react";
import { getTableQr, saveLastOrderId } from "@/lib/orderSession";

export default function CartPage() {
  const router = useRouter();
  const { items, tableId, tableNumber, subtotal, totalItems, updateQuantity, removeItem, updateInstructions, clearCart } = useCart();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState<string | null>(null);
  const tax = Math.round(subtotal * 0.1 * 100) / 100;
  const total = subtotal + tax;

  const handlePlaceOrder = async () => {
    if (!tableId || items.length === 0) return;
    setSubmitting(true);
    try {
      const order = await createOrder({
        tableId, notes: notes || null,
        items: items.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity, specialInstructions: i.specialInstructions || null })),
      });
      saveLastOrderId(order.id);
      clearCart();
      router.push(`/order/${order.id}`);
    } catch (e) { alert("Failed to place order."); console.error(e); } finally { setSubmitting(false); }
  };

  if (items.length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
      <h2 className="text-xl font-bold text-gray-700">Your cart is empty</h2>
      <p className="text-gray-400 mt-2">Add some delicious items from the menu</p>
      <button
        onClick={() => router.push(`/menu?qr=${encodeURIComponent(getTableQr() || "QS-TABLE-001")}`)}
        className="btn-primary mt-6"
      >
        Browse Menu
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(`/menu?qr=${encodeURIComponent(getTableQr() || "QS-TABLE-001")}`)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-xl"
            aria-label="Back to menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center"><h1 className="text-lg font-bold">Your Order</h1>{tableNumber && <p className="text-xs text-gray-500">Table {tableNumber}</p>}</div>
          <div className="w-9" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {items.map((item) => (
          <div key={item.menuItem.id} className="card">
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-100 to-brand-200 rounded-xl flex items-center justify-center text-xl shrink-0">🍽️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold truncate">{item.menuItem.name}</h3>
                  <button onClick={() => removeItem(item.menuItem.id)} className="p-1 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
                <p className="text-brand-600 font-bold text-sm">${item.menuItem.price.toFixed(2)} each</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"><Minus className="w-4 h-4" /></button>
                    <span className="font-semibold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center bg-brand-500 text-white rounded-lg hover:bg-brand-600"><Plus className="w-4 h-4" /></button>
                  </div>
                  <span className="font-bold">${(item.menuItem.price * item.quantity).toFixed(2)}</span>
                </div>
                <button onClick={() => setShowInstructions(showInstructions === item.menuItem.id ? null : item.menuItem.id)} className="flex items-center gap-1 text-xs text-gray-400 mt-2 hover:text-gray-600">
                  <MessageSquare className="w-3 h-3" /> Special instructions
                </button>
                {showInstructions === item.menuItem.id && (
                  <textarea value={item.specialInstructions} onChange={(e) => updateInstructions(item.menuItem.id, e.target.value)}
                    placeholder="e.g. No onions, extra sauce..." className="w-full mt-2 p-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 resize-none" rows={2} />
                )}
              </div>
            </div>
          </div>
        ))}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Order Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requests..."
            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 resize-none text-sm" rows={3} />
        </div>
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          <div className="flex justify-between text-sm text-gray-500"><span>Subtotal ({totalItems} items)</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm text-gray-500"><span>Tax (10%)</span><span>${tax.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-lg border-t border-gray-100 pt-2"><span>Total</span><span className="text-brand-600">${total.toFixed(2)}</span></div>
          <button onClick={handlePlaceOrder} disabled={submitting} className="btn-primary w-full disabled:opacity-50">{submitting ? "Placing Order..." : "Place Order"}</button>
        </div>
      </div>
    </div>
  );
}
