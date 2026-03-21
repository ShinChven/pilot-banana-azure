import { apiGet, apiPost, apiPatch, apiDelete, type PaginatedList } from './client';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatarSeed: string;
  role: string;
  disabled: boolean;
  hasPassword: boolean;
  passkeyCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role: string;
  password?: string | null;
}

export interface UpdateUserRequest {
  email?: string | null;
  name?: string | null;
  role?: string | null;
  disabled?: boolean | null;
  password?: string | null;
  avatarSeed?: string | null;
  deletePassword?: boolean | null;
}

export function listUsers(token: string, page = 1, pageSize = 10) {
  return apiGet<PaginatedList<UserResponse>>(`/users?page=${page}&pageSize=${pageSize}`, token);
}

export function createUser(body: CreateUserRequest, token: string) {
  return apiPost<UserResponse>('/users', body, token);
}

export function updateUser(id: string, body: UpdateUserRequest, token: string) {
  return apiPatch<UserResponse>(`/users/${id}`, body, token);
}

export function updateMe(body: UpdateUserRequest, token: string) {
  return apiPatch<UserResponse>('/auth/me', body, token);
}

export function deleteUser(id: string, token: string) {
  return apiDelete(`/users/${id}`, token);
}
