import { apiGet, apiPost, type PaginatedList } from "./client";

export interface AiTask {
  id: string;
  postId: string;
  campaignId: string;
  userId: string;
  promptText: string;
  resultText: string | null;
  status: 'Pending' | 'Processing' | 'Succeeded' | 'Failed';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export function listAiTasks(userId: string, status: string | null, token: string, page = 1, pageSize = 10) {
  const statusQuery = status ? `&status=${status}` : "";
  return apiGet<PaginatedList<AiTask>>(`/users/${userId}/ai-tasks?page=${page}&pageSize=${pageSize}${statusQuery}`, token);
}

export function retryAiTask(userId: string, taskId: string, token: string) {
  return apiPost<any>(`/users/${userId}/ai-tasks/${taskId}/retry`, {}, token);
}
