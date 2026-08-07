import type { SavedStyleData } from "./savedStyle";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface SavedStyleRecord {
  id: number;
  userId: number;
  name: string;
  data: SavedStyleData;
  createdAt: string;
}

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function listSavedStyles(token: string | null): Promise<{ ok: boolean; styles?: SavedStyleRecord[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/saved-styles`, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message ?? data.error ?? "خطای ناشناخته" };
    return { ok: true, styles: data.savedStyles };
  } catch {
    return { ok: false, error: "خطا در ارتباط با سرور" };
  }
}

export async function createSavedStyle(token: string | null, name: string, data: SavedStyleData): Promise<{ ok: boolean; style?: SavedStyleRecord; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/saved-styles`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name, data }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message ?? json.error ?? "خطای ناشناخته" };
    return { ok: true, style: json.savedStyle };
  } catch {
    return { ok: false, error: "خطا در ارتباط با سرور" };
  }
}

export async function deleteSavedStyle(token: string | null, id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/saved-styles/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.message ?? json.error ?? "خطای ناشناخته" };
    return { ok: true };
  } catch {
    return { ok: false, error: "خطا در ارتباط با سرور" };
  }
}
