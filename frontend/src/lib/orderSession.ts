"use client";

const TABLE_QR_KEY = "quickserve_table_qr";
const LAST_ORDER_ID_KEY = "quickserve_last_order_id";

export function saveTableQr(qr: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TABLE_QR_KEY, qr);
}

export function getTableQr() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TABLE_QR_KEY) || "";
}

export function saveLastOrderId(orderId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_ORDER_ID_KEY, orderId);
}

export function getLastOrderId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LAST_ORDER_ID_KEY) || "";
}

export function clearLastOrderId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LAST_ORDER_ID_KEY);
}
