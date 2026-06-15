"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  ApiUser,
  ApiClientCard,
  ApiLoginResponse,
  loginEmail,
  logoutEmail,
  fetchMe,
  refreshTokenAction,
  setApiToken,
  getApiToken,
  getStoredRefreshToken,
} from "../lib/api";

interface AuthContextType {
  user: ApiUser | null;
  token: string | null;
  isClientUser: boolean;
  isUserTechnician: boolean;
  clients: ApiClientCard[];
  loading: boolean;
  login: (email: string, password: string) => Promise<ApiLoginResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isClientUser, setIsClientUser] = useState(false);
  const [isUserTechnician, setIsUserTechnician] = useState(false);
  const [clients, setClients] = useState<ApiClientCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep module-level token cache in sync whenever token state changes.
  // Guard against null so the initial render (token = null) never wipes
  // the persisted token from localStorage before hydrateSession reads it.
  useEffect(() => {
    if (token !== null) setApiToken(token);
  }, [token]);

  // Hydrate session from localStorage on startup
  useEffect(() => {
    async function hydrateSession() {
      try {
        const storedToken = getApiToken();
        if (!storedToken) return;

        setToken(storedToken);
        try {
          const profile = await fetchMe();
          setUser(profile);
          // Restore isClientUser / isUserTechnician from stored user if available
          const storedUser = _readStoredUser();
          if (storedUser) {
            setIsClientUser(storedUser.isClientUser ?? false);
            setIsUserTechnician(storedUser.isUserTechnician ?? false);
            setClients(storedUser.clients ?? []);
          }
        } catch {
          // Access token expired — try silent refresh
          const storedRefresh = getStoredRefreshToken();
          if (!storedRefresh) throw new Error("No refresh token.");
          const refreshed = await refreshTokenAction(storedRefresh);
          setToken(refreshed.token);
          const profile = await fetchMe();
          setUser(profile);
        }
      } catch (err) {
        console.warn("Auth hydration failed — clearing session:", err);
        setToken(null);
        setUser(null);
        setApiToken(null);
      } finally {
        setLoading(false);
      }
    }
    hydrateSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background token refresh every 10 minutes
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      const storedRefresh = getStoredRefreshToken();
      if (!storedRefresh) return;
      try {
        const refreshed = await refreshTokenAction(storedRefresh);
        setToken(refreshed.token);
      } catch {
        console.warn("Background token refresh failed.");
      }
    }, 1000 * 60 * 10);
    return () => clearInterval(interval);
  }, [token]);

  const login = useCallback(
    async (email: string, password: string): Promise<ApiLoginResponse> => {
      setLoading(true);
      try {
        const data = await loginEmail(email, password);
        setToken(data.token);
        setUser(data.user);
        setIsClientUser(data.isClientUser ?? false);
        setIsUserTechnician(data.isUserTechnician ?? false);
        setClients(data.clients ?? []);
        // Persist extra context so session hydration can restore it
        _writeStoredUser({
          isClientUser: data.isClientUser,
          isUserTechnician: data.isUserTechnician,
          clients: data.clients,
        });
        return data;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutEmail();
    } catch {
      // ignore
    } finally {
      setToken(null);
      setUser(null);
      setIsClientUser(false);
      setIsUserTechnician(false);
      setClients([]);
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const storedRefresh = getStoredRefreshToken();
    if (!storedRefresh) return false;
    try {
      const data = await refreshTokenAction(storedRefresh);
      setToken(data.token);
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isClientUser,
        isUserTechnician,
        clients,
        loading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be nested within an AuthProvider");
  }
  return context;
}

// ---------------------------------------------------------------------------
// Internal helpers for persisting session metadata across page loads
// ---------------------------------------------------------------------------

interface StoredSessionMeta {
  isClientUser: boolean;
  isUserTechnician: boolean;
  clients: ApiClientCard[];
}

function _writeStoredUser(meta: StoredSessionMeta) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("industrial_os_session_meta", JSON.stringify(meta));
  }
}

function _readStoredUser(): StoredSessionMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("industrial_os_session_meta");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
