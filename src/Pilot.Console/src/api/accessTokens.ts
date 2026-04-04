import { apiGet, apiPost, apiDelete, type PaginatedList } from './client';

export interface AccessTokenCreated {
  id: string;
  name: string;
  token: string;
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface AccessToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isRevoked: boolean;
}

export function listAccessTokens(token: string, page: number = 1, pageSize: number = 10) {
  return apiGet<PaginatedList<AccessToken>>(`/auth/access-tokens?page=${page}&pageSize=${pageSize}`, token);
}

export function createAccessToken(body: { name: string; expiresInDays?: number | null }, token: string) {
  return apiPost<AccessTokenCreated>('/auth/access-tokens', body, token);
}

export function revokeAccessToken(tokenId: string, token: string) {
  return apiDelete(`/auth/access-tokens/${tokenId}`, token);
}
