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
  getStats: (token: string | null) => apiGet<DashboardStats>('/stats', token),
}
