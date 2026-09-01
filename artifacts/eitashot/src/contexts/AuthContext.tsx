import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useRef,
} from "react";

// ── Eitaa SDK global types ────────────────────────────────────────────────────
export interface EitaaWebApp {
  ready(): void;
  expand(): void;
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  requestWriteAccess?(callback?: (granted: boolean) => void): void;
}

declare global {
  interface Window {
    Eitaa?: { WebApp?: EitaaWebApp };
  }
}

// ── App-level user shape ──────────────────────────────────────────────────────
export interface AppUser {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

// ── Auth state machine ────────────────────────────────────────────────────────
export type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | {
      status: "needs_username";
      tempToken: string;
      eitaaUser: { id: string; firstName?: string | null; lastName?: string | null };
    }
  | { status: "authenticated"; user: AppUser; token: string };

type AuthAction =
  | { type: "GUEST" }
  | { type: "NEEDS_USERNAME"; tempToken: string; eitaaUser: AuthState & { status: "needs_username" } extends { eitaaUser: infer U } ? U : never }
  | { type: "AUTHENTICATED"; user: AppUser; token: string }
  | { type: "LOGOUT" };

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "GUEST":          return { status: "guest" };
    case "NEEDS_USERNAME": return { status: "needs_username", tempToken: action.tempToken, eitaaUser: action.eitaaUser };
    case "AUTHENTICATED":  return { status: "authenticated", user: action.user, token: action.token };
    case "LOGOUT":         return { status: "guest" };
    default:               return state;
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const TOKEN_KEY = "eitashot_token";

async function apiFetch(
  path: string,
  options?: RequestInit,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}/api/auth${path}`, { ...options, headers });
}

// ── Context value ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  auth: AuthState;
  /** Whether the backend is in test mode (dev session available, guest access OK). */
  testMode: boolean;
  /** When true, the frontend must not render the app (non-Eitaa user in production). */
  blocked: boolean;
  /** Whether the backend config has been fetched. Used to prevent flash of content. */
  configLoaded: boolean;
  /** @deprecated Backend-only config flag — kept for API compatibility but no longer gates UI. */
  authRequired: boolean;
  /** Manually trigger Eitaa SDK login (no-op in simulated dev mode). */
  login(): Promise<void>;
  logout(): void;
  /**
   * Called after the user picks a username and accepts the ToS.
   * tosAccepted must be true — backend will reject the request otherwise.
   */
  completeSignup(username: string, tosAccepted: boolean): Promise<{ ok: boolean; error?: string }>;
  /** Update the authenticated user's username via PATCH /api/auth/me. */
  updateUsername(username: string): Promise<{ ok: boolean; error?: string }>;
  /** Helper: get the stored Bearer token for authenticated API calls. */
  getToken(): string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, dispatch] = useReducer(reducer, { status: "loading" });
  const [authRequired] = React.useState(false);
  const [testMode, setTestMode] = React.useState(true); // default true = safe dev default
  const [blocked, setBlocked] = React.useState(false);
  const [configLoaded, setConfigLoaded] = React.useState(false);
  const didInit = useRef(false);

  // Shared: try Eitaa initData → resolve authenticated / needs_username
  const attemptEitaaLogin = useCallback(async (): Promise<boolean> => {
    const webapp = window.Eitaa?.WebApp;
    if (!webapp) return false;
    try {
      webapp.ready();
      const initData = webapp.initData;
      if (!initData) return false;

      const res = await apiFetch("/eitaa", {
        method: "POST",
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) return false;

      const data = await res.json() as {
        status: string;
        token?: string;
        user?: AppUser;
        tempToken?: string;
        eitaaUser?: { id: string; firstName?: string | null; lastName?: string | null };
      };

      if (data.status === "ok" && data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        dispatch({ type: "AUTHENTICATED", user: data.user, token: data.token });
        return true;
      }
      if (data.status === "needs_username" && data.tempToken && data.eitaaUser) {
        dispatch({ type: "NEEDS_USERNAME", tempToken: data.tempToken, eitaaUser: data.eitaaUser });
        return true;
      }
    } catch (err) {
      console.warn("[auth] Eitaa SDK error:", err);
    }
    return false;
  }, []);

  // On mount: fetch config → restore session → dev-session → Eitaa SDK → guest
  useEffect(() => {
    if (didInit.current) return; // StrictMode guard
    didInit.current = true;

    (async () => {
      // 0. Fetch backend config to determine testMode (fire-and-forget for UI gating).
      //    We do NOT gate auth decisions on this — the backend already enforces
      //    testMode on /dev-session, so we always attempt it and let the server decide.
      fetch(`${API_BASE}/api/config`)
        .then(r => r.ok ? r.json() : null)
        .then(cfg => {
          if (!cfg) return;
          if (typeof cfg.testMode === "boolean") setTestMode(cfg.testMode);
          if (typeof cfg.blocked === "boolean") setBlocked(cfg.blocked);
        })
        .catch(() => { /* silent */ })
        .finally(() => setConfigLoaded(true));

      // 1. Try existing session token
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        try {
          const res = await apiFetch("/me", { method: "GET" }, stored);
          if (res.ok) {
            const data = await res.json() as { user: AppUser };
            dispatch({ type: "AUTHENTICATED", user: data.user, token: stored });
            return;
          }
        } catch { /* network error — fall through */ }
        localStorage.removeItem(TOKEN_KEY); // expired / invalid
      }

      // 2. Dev-session auto-login.
      //    The backend gates this on isTestMode(): when TEST_MODE=false it returns
      //    404, so this is always safe to attempt regardless of frontend state.
      try {
        const res = await apiFetch("/dev-session", { method: "GET" });
        if (res.ok) {
          const data = await res.json() as { status?: string; token?: string; user?: AppUser };
          if (data.status === "ok" && data.token && data.user) {
            localStorage.setItem(TOKEN_KEY, data.token);
            dispatch({ type: "AUTHENTICATED", user: data.user, token: data.token });
            return;
          }
        }
      } catch { /* network error — fall through to Eitaa SDK */ }

      // 3. Auto-login via Eitaa SDK (works when opened inside Eitaa app)
      const sdkOk = await attemptEitaaLogin();
      if (sdkOk) return;

      // 4. Guest fallback
      dispatch({ type: "GUEST" });
    })();
  }, [attemptEitaaLogin]);

  // Manual login — triggers the Eitaa SDK.
  const login = useCallback(async () => {
    const sdkOk = await attemptEitaaLogin();
    if (!sdkOk) dispatch({ type: "GUEST" });
  }, [attemptEitaaLogin]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    dispatch({ type: "LOGOUT" });
  }, []);

  const completeSignup = useCallback(
    async (username: string, tosAccepted: boolean): Promise<{ ok: boolean; error?: string }> => {
      if (auth.status !== "needs_username") {
        return { ok: false, error: "invalid state" };
      }
      try {
        const res = await apiFetch("/complete-signup", {
          method: "POST",
          body: JSON.stringify({ tempToken: auth.tempToken, username, tosAccepted }),
        });
        const data = await res.json() as {
          status?: string; token?: string; user?: AppUser; message?: string; error?: string;
        };
        if (!res.ok) {
          return { ok: false, error: data.message ?? data.error ?? "خطای ناشناخته" };
        }
        if (data.token && data.user) {
          localStorage.setItem(TOKEN_KEY, data.token);
          dispatch({ type: "AUTHENTICATED", user: data.user, token: data.token });

          // After first-time registration, request Eitaa bot message permission.
          // This is fire-and-forget: the user can refuse and still use the app.
          // Only runs when the Eitaa SDK is available (inside Eitaa app).
          const webapp = window.Eitaa?.WebApp;
          if (webapp?.requestWriteAccess) {
            try {
              webapp.requestWriteAccess((granted: boolean) => {
                console.log(
                  granted
                    ? "[auth] Eitaa message permission granted"
                    : "[auth] Eitaa message permission declined",
                );
              });
            } catch {
              // SDK call failed — not critical, app continues normally
            }
          }

          return { ok: true };
        }
        return { ok: false, error: "پاسخ سرور نامعتبر است" };
      } catch {
        return { ok: false, error: "خطا در ارتباط با سرور" };
      }
    },
    [auth],
  );

  const updateUsername = useCallback(
    async (username: string): Promise<{ ok: boolean; error?: string }> => {
      const token = auth.status === "authenticated" ? auth.token : localStorage.getItem(TOKEN_KEY);
      if (!token) return { ok: false, error: "not authenticated" };
      try {
        const res = await apiFetch("/me", {
          method: "PATCH",
          body: JSON.stringify({ username }),
        }, token);
        const data = await res.json() as { user?: AppUser; message?: string; error?: string };
        if (!res.ok) return { ok: false, error: data.message ?? data.error ?? "خطای ناشناخته" };
        if (data.user && auth.status === "authenticated") {
          dispatch({ type: "AUTHENTICATED", user: data.user, token: auth.token });
        }
        return { ok: true };
      } catch {
        return { ok: false, error: "خطا در ارتباط با سرور" };
      }
    },
    [auth],
  );

  const getToken = useCallback(() => {
    if (auth.status === "authenticated") return auth.token;
    return localStorage.getItem(TOKEN_KEY);
  }, [auth]);

  return (
    <AuthContext.Provider value={{ auth, testMode, blocked, configLoaded, authRequired, login, logout, completeSignup, updateUsername, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
