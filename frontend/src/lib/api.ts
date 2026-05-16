const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5139";

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem("quickserve_user");
  if (!stored) return {};
  try {
    const user = JSON.parse(stored);
    return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
  } catch {
    return {};
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export const getCategories = () => fetchApi<any[]>("/api/menu/categories");
export const getMenuItems  = () => fetchApi<any[]>("/api/menu/items");

export const createMenuItem = (data: any) =>
  fetchApi("/api/menu/items", { method: "POST", body: JSON.stringify(data) });
export const updateMenuItem = (id: string, data: any) =>
  fetchApi(`/api/menu/items/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteMenuItem = (id: string) =>
  fetchApi(`/api/menu/items/${id}`, { method: "DELETE" });
export const createCategory = (data: any) =>
  fetchApi("/api/menu/categories", { method: "POST", body: JSON.stringify(data) });

export const getTables      = () => fetchApi<any[]>("/api/tables");
export const getTable       = (id: string) => fetchApi<any>(`/api/tables/${id}`);
export const getTableByQr   = (qr: string) => fetchApi<any>(`/api/tables/qr/${qr}`);
export const createTable = (data: { tableNumber?: number; seats?: number }) =>
  fetchApi("/api/tables", { method: "POST", body: JSON.stringify(data) });
export const deleteTable = (id: string) =>
  fetchApi(`/api/tables/${id}`, { method: "DELETE" });

export const getOrders = (status?: string, page = 1, pageSize = 50) =>
  fetchApi<any[]>(`/api/orders?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ""}`);
export const getOrder         = (id: string) => fetchApi<any>(`/api/orders/${id}`);
export const getOrdersByTable = (tableId: string) => fetchApi<any[]>(`/api/orders/table/${tableId}`);
export const createOrder      = (data: any) =>
  fetchApi<any>("/api/orders", { method: "POST", body: JSON.stringify(data) });
export const updateOrderStatus = (id: string, status: string) =>
  fetchApi(`/api/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
export const updatePayment = (id: string, paymentStatus: string, paymentMethod: string) =>
  fetchApi(`/api/orders/${id}/payment`, { method: "PUT", body: JSON.stringify({ paymentStatus, paymentMethod }) });

export const getDashboardAnalytics = () => fetchApi<any>("/api/analytics/dashboard");

export const login = (email: string, password: string) =>
  fetchApi<any>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const register = (email: string, password: string, fullName: string, role: string) =>
  fetchApi<any>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName, role }),
  });

export const uploadMenuItemImage = async (id: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/menu/items/${id}/image`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
};

export const deleteMenuItemImage = (id: string) =>
  fetchApi(`/api/menu/items/${id}/image`, { method: "DELETE" });
