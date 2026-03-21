import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'

const TOKEN_KEY = 'pilot_token'

interface User {
  id: string
  email: string
  role: string
  name: string
  avatarSeed: string
  avatarUrl: string
  avatarEmoji?: string
  hasPassword: boolean
  passkeyCount: number
}

interface AuthContextValue {
  token: string | null
  user: User | null
  loading: boolean
  login: (email: string, password: string, rememberMe: boolean) => Promise<{ error?: string }>
  loginWithToken: (token: string) => Promise<{ error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const getAvatarData = (seed: string) => {
  if (seed.startsWith('emoji:')) {
    return {
      avatarSeed: seed,
      avatarUrl: '',
      avatarEmoji: seed.substring(6)
    };
  }
  return {
    avatarSeed: seed,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`,
    avatarEmoji: undefined
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      setUser(null)
      setLoading(false)
      return
    }
    const { data, status: st } = await authApi.me(t)
    if (st === 401 || !data) {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    } else {
      setToken(t)
      const me = data as any;
      const seed = me.avatarSeed ?? me.AvatarSeed ?? me.id ?? me.Id ?? '';
      const avatarData = getAvatarData(seed);
      setUser({ 
        id: me.id ?? me.Id ?? '', 
        email: me.email ?? me.Email ?? '', 
        role: me.role ?? me.Role ?? '',
        name: me.name ?? me.Name ?? (me.email ?? me.Email ?? '').split('@')[0],
        hasPassword: me.hasPassword ?? me.HasPassword ?? false,
        passkeyCount: me.passkeyCount ?? me.PasskeyCount ?? 0,
        ...avatarData
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const { data, error } = await authApi.login({ email, password, rememberMe })
    const token = data && ('accessToken' in data ? data.accessToken : (data as { AccessToken?: string }).AccessToken)
    if (error || !token) {
      return { error: error ?? 'Login failed' }
    }
    localStorage.setItem(TOKEN_KEY, token)
    setToken(token)
    const meRes = await authApi.me(token)
    const me = meRes.data as any
    if (me) {
      const seed = me.avatarSeed ?? me.AvatarSeed ?? me.id ?? me.Id ?? '';
      const avatarData = getAvatarData(seed);
      setUser({ 
        id: me.id ?? me.Id ?? '', 
        email: me.email ?? me.Email ?? '', 
        role: me.role ?? me.Role ?? '',
        name: me.name ?? me.Name ?? (me.email ?? me.Email ?? '').split('@')[0],
        hasPassword: me.hasPassword ?? me.HasPassword ?? false,
        passkeyCount: me.passkeyCount ?? me.PasskeyCount ?? 0,
        ...avatarData
      })
    }
    return {}
  }, [])

  const loginWithToken = useCallback(async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    setToken(token)
    const meRes = await authApi.me(token)
    const me = meRes.data as any
    if (me) {
      const seed = me.avatarSeed ?? me.AvatarSeed ?? me.id ?? me.Id ?? '';
      const avatarData = getAvatarData(seed);
      setUser({ 
        id: me.id ?? me.Id ?? '', 
        email: me.email ?? me.Email ?? '', 
        role: me.role ?? me.Role ?? '',
        name: me.name ?? me.Name ?? (me.email ?? me.Email ?? '').split('@')[0],
        hasPassword: me.hasPassword ?? me.HasPassword ?? false,
        passkeyCount: me.passkeyCount ?? me.PasskeyCount ?? 0,
        ...avatarData
      })
      return {}
    } else {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      return { error: 'Failed to retrieve profile. Session invalid.' }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      logout()
    }
    window.addEventListener('pilot:unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('pilot:unauthorized', handleUnauthorized)
    }
  }, [logout])

  return (
    <AuthContext.Provider value={{ token, user, loading, login, loginWithToken, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
