"use client";
import { useRef, useState } from "react";
import { RestaurantTable } from "@/types";
import { QrCode, Printer, Plus, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

function tableMenuUrl(qrCode: string) {
  const base = SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/menu?qr=${encodeURIComponent(qrCode)}`;
}

interface Props {
  tables: RestaurantTable[];
  onCreateTable: (data: { tableNumber?: number; seats?: number }) => Promise<void>;
  onDeleteTable: (id: string) => Promise<void>;
}

export default function TablesTab({ tables, onCreateTable, onDeleteTable }: Props) {
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [seats, setSeats] = useState("4");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCreate = async () => {
    setError("");
    setSubmitting(true);
    try {
      const parsedTableNumber = tableNumber.trim() ? Number(tableNumber) : undefined;
      const parsedSeats = seats.trim() ? Number(seats) : undefined;

      if (parsedTableNumber !== undefined && (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1)) {
        setError("Table number must be a whole number of at least 1");
        return;
      }
      if (parsedSeats !== undefined && (!Number.isInteger(parsedSeats) || parsedSeats < 1)) {
        setError("Seats must be a whole number of at least 1");
        return;
      }

      await onCreateTable({
        tableNumber: parsedTableNumber,
        seats: parsedSeats,
      });
      setTableNumber("");
      setSeats("4");
      setShowCreateForm(false);
    } catch (e: any) {
      setError(e?.message || "Failed to create table");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (table: RestaurantTable) => {
    const ok = window.confirm(
      `Delete Table ${table.tableNumber}? This is only allowed if the table has no order history.`,
    );
    if (!ok) return;

    setDeletingId(table.id);
    setError("");
    try {
      await onDeleteTable(table.id);
    } catch (e: any) {
      setError(e?.message || "Failed to delete table");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = () => {
    if (!qrRef.current || !selectedTable) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Table ${selectedTable.tableNumber}</title>
      <style>body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .c{text-align:center;padding:40px;border:3px solid #ea580c;border-radius:24px;max-width:360px}
      h1{font-size:28px;margin-bottom:4px;color:#ea580c}h2{font-size:48px;font-weight:bold;margin:8px 0}
      p{color:#666;margin:4px 0;font-size:14px}.qr{margin:24px 0}.s{font-size:18px;font-weight:bold;color:#333;margin-top:16px}
      .u{font-size:10px;color:#999;word-break:break-all;margin-top:12px}.f{font-size:11px;color:#999;margin-top:20px}</style></head>
      <body><div class="c"><h1>QuickServe QR</h1><h2>Table ${selectedTable.tableNumber}</h2>
      <p>${selectedTable.seats} seats</p><div class="qr">${qrRef.current.innerHTML}</div>
      <p class="s">📱 Scan to view menu & order</p>
      <p class="u">${tableMenuUrl(selectedTable.qrCode)}</p>
      <div class="f">Powered by QuickServe QR</div></div></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <>
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <QrCode className="w-5 h-5 text-brand-500" /> Table QR Code
              </h2>
              <button onClick={() => setSelectedTable(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center space-y-1">
              <p className="text-5xl font-extrabold text-brand-600">Table {selectedTable.tableNumber}</p>
              <p className="text-sm text-gray-500">
                {selectedTable.seats} seats · {selectedTable.isOccupied ? "🔴 Occupied" : "🟢 Available"}
              </p>
            </div>
            <div className="flex justify-center py-4 bg-gray-50 rounded-2xl" ref={qrRef}>
              <QRCodeSVG value={tableMenuUrl(selectedTable.qrCode)} size={200} level="H" includeMargin bgColor="#FFFFFF" fgColor="#1a1a2e" />
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Menu URL:</p>
              <p className="text-xs font-mono text-brand-600 break-all">{tableMenuUrl(selectedTable.qrCode)}</p>
            </div>
            <div className="space-y-2">
              <button onClick={handlePrint} className="w-full btn-primary flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print QR Code
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tableMenuUrl(selectedTable.qrCode));
                }}
                className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
              >
                📋 Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card border-brand-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">Tables</h3>
            <p className="text-sm text-gray-500">Add new tables and generate QR codes.</p>
          </div>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>

        {showCreateForm && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
              <input
                type="number"
                min="1"
                placeholder="Auto"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
              <input
                type="number"
                min="1"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="btn-primary text-sm flex-1 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Table"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setError("");
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((t) => (
          <div
            key={t.id}
            onClick={() => setSelectedTable(t)}
            className={`relative card text-center cursor-pointer hover:shadow-md transition-shadow ${t.isOccupied ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(t);
              }}
              disabled={deletingId === t.id}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-lg bg-white/90 hover:bg-red-50 text-red-500 shadow-sm disabled:opacity-50"
              title="Delete table"
              aria-label={`Delete table ${t.tableNumber}`}
            >
              {deletingId === t.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-500" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
            <p className="text-3xl mb-2">🪑</p>
            <p className="font-bold text-lg">Table {t.tableNumber}</p>
            <p className="text-sm text-gray-500">{t.seats} seats</p>
            <span className={`badge mt-2 ${t.isOccupied ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              {t.isOccupied ? "Occupied" : "Available"}
            </span>
            <div className="mt-3 flex items-center justify-center gap-1 text-xs text-brand-500 font-medium">
              <QrCode className="w-3 h-3" /> View QR
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
