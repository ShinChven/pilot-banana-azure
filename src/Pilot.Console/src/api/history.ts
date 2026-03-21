import { apiGet } from './client';
import { PostHistoryItem, PaginatedList } from '../types';

export async function getCampaignHistory(userId: string, campaignId: string, token: string, page = 1, pageSize = 10) {
  // Use absolute path for users/ campaigns history as it's outside the standard /api base if client adds it
  // Actually client adds /api if not starting with /
  return apiGet<PaginatedList<PostHistoryItem>>(`/users/${userId}/campaigns/${campaignId}/history?page=${page}&pageSize=${pageSize}`, token);
}

export async function getGlobalHistory(token: string, page = 1, pageSize = 10) {
  return apiGet<PaginatedList<PostHistoryItem>>(`/system/history?page=${page}&pageSize=${pageSize}`, token);
}
