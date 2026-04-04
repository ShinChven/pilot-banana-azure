export interface User {
  id: string;
  name: string;
  email: string;
  avatarSeed: string;
  role: 'Admin' | 'User';
  status: 'Active' | 'Inactive';
  lastActive: string;
  hasPassword: boolean;
  passkeyCount: number;
}

export interface AnalyticsData {
  name: string;
  revenue: number;
  users: number;
}

export interface Channel {
  id: string;
  platform: 'X' | 'Instagram' | 'LinkedIn' | 'Facebook';
  username: string;
  handle?: string;
  avatar: string;
  profileUrl?: string;
  status: 'Connected' | 'Disconnected' | 'Expired';
  followers: number;
  lastSync: string;
  enabled: boolean;
}

export interface ScheduledPost {
  id: string;
  content: string;
  images?: string[];
  optimizedUrls?: string[];
  thumbnailUrls?: string[];
  scheduledAt?: string;
  status: 'Draft' | 'Scheduled' | 'Pending' | 'Posted' | 'Failed' | 'Generating';
  channels: string[]; // IDs of channels
  postUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  startDate: string;
  endDate: string;
  channels: string[]; // IDs of channels
  posts: ScheduledPost[];
  thumbnail: string;
  totalPosts?: number;
  postedPosts?: number;
  draftPosts?: number;
  scheduledPosts?: number;
  failedPosts?: number;
  generatingPosts?: number;
}

export interface Prompt {
  id: string;
  title: string;
  text: string;
  author: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostHistoryItem {
  id: string;
  campaignId: string;
  userId: string;
  postId: string;
  channelLinkId: string;
  platform: string;
  externalPostId?: string;
  postUrl?: string;
  postedAt: string;
  status: string;
  errorMessage?: string;
  avatarUrl?: string;
  displayName?: string;
  username?: string;
  campaignName?: string;
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
