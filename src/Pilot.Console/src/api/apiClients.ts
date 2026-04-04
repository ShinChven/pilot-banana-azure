import { apiGet, apiPost, apiDelete, type PaginatedList } from './client';

export interface ApiClient {
  clientId: string;
  name: string;
  redirectUri: string;
  createdAt: string;
  lastUsedAt: string | null;
  isRevoked: boolean;
}

export interface ApiClientCreated {
  clientId: string;
  clientSecret: string;
  name: string;
  redirectUri: string;
  createdAt: string;
}

export function listApiClients(token: string, page: number = 1, pageSize: number = 10) {
  return apiGet<PaginatedList<ApiClient>>(`/auth/api-clients?page=${page}&pageSize=${pageSize}`, token);
}

export function createApiClient(body: { name: string; redirectUri: string }, token: string) {
  return apiPost<ApiClientCreated>('/auth/api-clients', body, token);
}

export function revokeApiClient(clientId: string, token: string) {
  return apiDelete(`/auth/api-clients/${clientId}`, token);
}

export function approveOAuth(body: { clientId: string; redirectUri?: string; state?: string; codeChallenge?: string; codeChallengeMethod?: string }, token: string) {
  return apiPost<{ redirectUrl: string }>('/oauth/authorize', body, token);
}
