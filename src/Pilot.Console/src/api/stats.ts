import { PostHistoryItem } from '../types'
import { apiGet } from './client'

export interface PostCountByDate {
  date: string
  count: number
}

export interface DashboardStats {
  activeCampaigns: number
  scheduledPosts: number
  connectedChannels: number
  recentHistory: PostHistoryItem[]
  automationOverview: PostCountByDate[]
}

export const statsApi = {
  getStats: (token: string | null, days: number = 7) => {
    const timezoneOffset = new Date().getTimezoneOffset();
    return apiGet<DashboardStats>(`/stats?timezoneOffset=${timezoneOffset}&days=${days}`, token);
  },
}
