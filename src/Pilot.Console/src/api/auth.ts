import { apiPost, apiGet } from './client';

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface TokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresInSeconds?: number;
}

export interface MeResponse {
  id: string;
  email: string;
  role: string;
  name: string;
  avatarSeed: string;
  hasPassword: boolean;
  passkeyCount: number;
}

export async function login(body: LoginRequest) {
  return apiPost<TokenResponse>('/auth/login', body, null);
}

export async function me(token: string) {
  return apiGet<MeResponse>('/auth/me', token);
}
