import { apiGet, apiPost, apiPatch, apiDelete, type PaginatedList } from './client';

export interface CampaignResponse {
  id: string;
  userId: string;
  name: string;
  description: string;
  channelLinkIds: string[];
  status: string;
  createdAt: string;
  updatedAt: string | null;
  totalPosts: number;
  postedPosts: number;
  endDate: string | null;
  draftPosts: number;
  scheduledPosts: number;
  failedPosts: number;
  generatingPosts: number;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  channelLinkIds?: string[];
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  channelLinkIds?: string[];
  status?: string;
}

export function listCampaigns(token: string, page = 1, pageSize = 10) {
  return apiGet<PaginatedList<CampaignResponse>>(`/campaigns?page=${page}&pageSize=${pageSize}`, token);
}

export function getCampaign(id: string, token: string) {
  return apiGet<CampaignResponse>(`/campaigns/${id}`, token);
}

export function createCampaign(body: CreateCampaignRequest, token: string) {
  return apiPost<CampaignResponse>('/campaigns', body, token);
}

export function updateCampaign(id: string, body: UpdateCampaignRequest, token: string) {
  return apiPatch<CampaignResponse>(`/campaigns/${id}`, body, token);
}

export function deleteCampaign(id: string, token: string) {
  return apiDelete(`/campaigns/${id}`, token);
}
