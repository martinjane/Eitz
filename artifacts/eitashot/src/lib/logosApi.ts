const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface LogoRecord {
  id: number;
  userId?: number;
  mimeType: string;
  size: number;
  data: string; // base64 data URL
  createdAt: string;
}

function authHeaders(token: string | null): Record<string, string> {
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/** List the current user's saved logos. */
export async function listLogos(
  token: string | null,
): Promise<{ ok: boolean; logos?: LogoRecord[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/logos`, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message ?? data.error ?? "خطای ناشناخته" };
    return { ok: true, logos: data.logos };
  } catch {
    return { ok: false, error: "خطا در ارتباط با سرور" };
  }
}

/** Upload a logo file to the user's account (max 5, backend compresses to ≤500 KB). */
export async function uploadLogo(
  token: string | null,
  file: File,
): Promise<{ ok: boolean; logo?: LogoRecord; error?: string }> {
  try {
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch(`${API_BASE}/api/logos`, {
      method: "POST",
      headers: authHeaders(token), // no Content-Type — browser sets multipart boundary
      body: form,
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message ?? data.error ?? "خطای ناشناخته" };
    return { ok: true, logo: data.logo };
  } catch {
    return { ok: false, error: "خطا در ارتباط با سرور" };
  }
}

/** Delete one of the user's saved logos. */
export async function deleteLogo(
  token: string | null,
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/logos/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message ?? data.error ?? "خطای ناشناخته" };
    return { ok: true };
  } catch {
    return { ok: false, error: "خطا در ارتباط با سرور" };
  }
}
