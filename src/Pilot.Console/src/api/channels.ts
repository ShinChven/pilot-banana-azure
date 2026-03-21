import { apiDelete, apiGet, apiPatch, apiPost, type PaginatedList } from './client';

export interface ChannelLinkResponse {
  id: string;
  userId: string;
  platform: string;
  externalId: string;
  displayName: string | null;
  username: string | null;
  note: string | null;
  isEnabled: boolean;
  profileUrl: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpdateChannelLinkRequest {
  note?: string;
  isEnabled?: boolean;
}

export interface ConnectChannelResponse {
  platform: string;
  authUrl?: string;
  message?: string;
}

/** API may return PascalCase; normalize to our shape. */
function toChannelLinkResponse(raw: Record<string, unknown>): ChannelLinkResponse {
  return {
    id: (raw.id ?? raw.Id) as string,
    userId: (raw.userId ?? raw.UserId) as string,
    platform: (raw.platform ?? raw.Platform) as string,
    externalId: (raw.externalId ?? raw.ExternalId) as string,
    displayName: (raw.displayName ?? raw.DisplayName) as string | null ?? null,
    username: (raw.username ?? raw.Username) as string | null ?? null,
    note: (raw.note ?? raw.Note) as string | null ?? null,
    isEnabled: (raw.isEnabled ?? raw.IsEnabled ?? true) as boolean,
    profileUrl: (raw.profileUrl ?? raw.ProfileUrl) as string | null ?? null,
    avatarUrl: (raw.avatarUrl ?? raw.AvatarUrl) as string | null ?? null,
    createdAt: (raw.createdAt ?? raw.CreatedAt) as string,
    updatedAt: (raw.updatedAt ?? raw.UpdatedAt) as string | null ?? null,
  };
}

export function listChannels(token: string, page = 1, pageSize = 10) {
  return apiGet<PaginatedList<Record<string, unknown>>>(`/channels?page=${page}&pageSize=${pageSize}`, token).then((res) => {
    if (!res.data) return { ...res, data: { items: [], total: 0, page, pageSize } as PaginatedList<ChannelLinkResponse> };

    // Check if it's already an array (old un-paginated fallback just in case)
    if (Array.isArray(res.data)) {
        const items = res.data.map(toChannelLinkResponse);
        return { ...res, data: { items, total: items.length, page: 1, pageSize: items.length } as PaginatedList<ChannelLinkResponse> };
    }

    const data = res.data.items && Array.isArray(res.data.items)
      ? res.data.items.map((item) => toChannelLinkResponse(item as Record<string, unknown>))
      : [];
    return { ...res, data: { ...res.data, items: data } as PaginatedList<ChannelLinkResponse> };
  });
}

export function getConnectUrl(platform: string, token: string) {
  return apiGet<ConnectChannelResponse>(`/channels/connect/${platform}`, token);
}

export function updateChannel(
  id: string,
  body: UpdateChannelLinkRequest,
  token: string
) {
  return apiPatch<unknown>(`/channels/${id}`, body, token).then((res) => {
    if (!res.data || typeof res.data !== 'object') return res as { data?: ChannelLinkResponse; error?: string; status: number };
    return { ...res, data: toChannelLinkResponse(res.data as Record<string, unknown>) };
  });
}

export function deleteChannel(id: string, token: string) {
  return apiDelete(`/channels/${id}`, token);
}

export function refreshChannelToken(id: string, token: string) {
  return apiPost<{ success: boolean }>(`/channels/${id}/refresh`, undefined, token);
}
