import { apiGet, apiDelete, type PaginatedList, apiPost, apiRequest } from "./client";

export interface PostResponse {
  id: string;
  campaignId: string;
  text: string | null;
  mediaUrls: string[] | null;
  optimizedUrls: string[] | null;
  thumbnailUrls: string[] | null;
  scheduledTime: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  postUrl?: string | null;
  campaignName?: string | null;
}

export function listPosts(userId: string, campaignId: string, token: string, page = 1, pageSize = 10, status?: string, search?: string, sortBy?: string, sortOrder?: string) {
  let url = `/users/${userId}/campaigns/${campaignId}/posts?page=${page}&pageSize=${pageSize}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (sortBy) url += `&sortBy=${encodeURIComponent(sortBy)}`;
  if (sortOrder) url += `&sortOrder=${encodeURIComponent(sortOrder)}`;
  return apiGet<PaginatedList<PostResponse>>(url, token);
}

export function listUserPosts(userId: string, token: string, page = 1, pageSize = 10, status?: string, search?: string, sortBy?: string, sortOrder?: string) {
  let url = `/users/${userId}/posts?page=${page}&pageSize=${pageSize}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (sortBy) url += `&sortBy=${encodeURIComponent(sortBy)}`;
  if (sortOrder) url += `&sortOrder=${encodeURIComponent(sortOrder)}`;
  return apiGet<PaginatedList<PostResponse>>(url, token);
}

export function getPost(userId: string, campaignId: string, postId: string, token: string) {
  return apiGet<PostResponse>(`/users/${userId}/campaigns/${campaignId}/posts/${postId}`, token);
}

export function deletePost(userId: string, campaignId: string, postId: string, token: string) {
  return apiDelete(`/users/${userId}/campaigns/${campaignId}/posts/${postId}`, token);
}

export async function updatePost(
  userId: string,
  campaignId: string,
  postId: string,
  text: string,
  files: FileList | File[],
  token: string,
  mediaOrder?: string[],
  status?: string,
  scheduledTime?: string
): Promise<{ data?: PostResponse; error?: string; status: number }> {
  const path = `/users/${userId}/campaigns/${campaignId}/posts/${postId}`;
  
  const formData = new FormData();
  formData.append("text", text);
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  if (mediaOrder) {
    if (mediaOrder.length === 0) {
      formData.append("mediaOrder", "");
    } else {
      for (const order of mediaOrder) {
        formData.append("mediaOrder", order);
      }
    }
  }

  if (status) {
    formData.append("status", status);
  }
  if (scheduledTime !== undefined) {
    formData.append("scheduledTime", scheduledTime);
  }

  return apiRequest<PostResponse>(path, { 
    method: "PUT", 
    body: formData, 
    token 
  });
}

export async function createPost(
  userId: string,
  campaignId: string,
  text: string,
  files: FileList | File[],
  token: string,
  status?: string,
  scheduledTime?: string
): Promise<{ data?: PostResponse; error?: string; status: number }> {
  const path = `/users/${userId}/campaigns/${campaignId}/posts`;

  const formData = new FormData();
  formData.append("text", text);
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  if (status) {
    formData.append("status", status);
  }
  if (scheduledTime !== undefined) {
    formData.append("scheduledTime", scheduledTime);
  }

  return apiRequest<PostResponse>(path, { 
    method: "POST", 
    body: formData, 
    token 
  });
}

export async function sendPost(userId: string, campaignId: string, postId: string, token: string) {
  const path = `/users/${userId}/campaigns/${campaignId}/posts/${postId}/send`;
  const res = await apiRequest<any>(path, {
    method: "POST",
    token
  });

  if (res.error) {
    throw new Error(res.error);
  }
  return res.data;
}

export async function batchGenerateText(userId: string, campaignId: string, postIds: string[], promptText: string, token: string) {
  const path = `/users/${userId}/posts/batch-generate-text`;
  const res = await apiPost<{ count: number; taskIds: string[] }>(path, { postIds, campaignId, promptText }, token);
  return res;
}

export async function batchSchedulePosts(userId: string, campaignId: string, schedules: { postId: string; scheduledTime: string }[], token: string) {
  const path = `/users/${userId}/posts/batch-schedule`;
  const res = await apiPost<{ count: number; errors?: string[] }>(path, { campaignId, schedules }, token);
  return res;
}

export async function batchUnschedulePosts(userId: string, campaignId: string, postIds: string[], token: string) {
  const path = `/users/${userId}/posts/batch-unschedule`;
  const res = await apiPost<{ count: number; errors?: string[] }>(path, { campaignId, postIds }, token);
  return res;
}
