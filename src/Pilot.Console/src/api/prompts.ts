import { apiGet, apiPost, apiPatch, apiDelete, type PaginatedList } from './client';

export interface PromptResponse {
  id: string;
  userId: string;
  title: string;
  text: string;
  author: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreatePromptRequest {
  title: string;
  text: string;
  author?: string;
}

export interface UpdatePromptRequest {
  title?: string;
  text?: string;
  author?: string;
}

export function listPrompts(token: string, page = 1, pageSize = 10) {
  return apiGet<PaginatedList<PromptResponse>>(`/prompts?page=${page}&pageSize=${pageSize}`, token);
}

export function getPrompt(id: string, token: string) {
  return apiGet<PromptResponse>(`/prompts/${id}`, token);
}

export function createPrompt(body: CreatePromptRequest, token: string) {
  return apiPost<PromptResponse>('/prompts', body, token);
}

export function updatePrompt(id: string, body: UpdatePromptRequest, token: string) {
  return apiPatch<PromptResponse>(`/prompts/${id}`, body, token);
}

export function deletePrompt(id: string, token: string) {
  return apiDelete(`/prompts/${id}`, token);
}
