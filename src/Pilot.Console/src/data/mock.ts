import { AnalyticsData, Prompt } from '../types';

export const mockAnalytics: AnalyticsData[] = [
  { name: 'Jan', revenue: 4000, users: 2400 },
  { name: 'Feb', revenue: 3000, users: 1398 },
  { name: 'Mar', revenue: 2000, users: 9800 },
  { name: 'Apr', revenue: 2780, users: 3908 },
  { name: 'May', revenue: 1890, users: 4800 },
  { name: 'Jun', revenue: 2390, users: 3800 },
  { name: 'Jul', revenue: 3490, users: 4300 },
];

export const mockPrompts: Prompt[] = [
  {
    id: 'pr1',
    title: 'Product Launch Announcement',
    text: 'Write a high-energy social media post announcing the launch of {product_name}. Focus on the key benefit: {key_benefit}. Include a call to action to visit {website_url}.',
    author: 'Alice Johnson',
    createdAt: '2024-03-01',
    updatedAt: '2024-03-01'
  },
  {
    id: 'pr2',
    title: 'Customer Success Story',
    text: 'Draft a professional post highlighting a success story from {customer_name}. Emphasize how our service helped them achieve {result}. Use a quote if possible.',
    author: 'Bob Smith',
    createdAt: '2024-03-05',
    updatedAt: '2024-03-10'
  },
  {
    id: 'pr3',
    title: 'Weekly Tech Tip',
    text: 'Create a short, helpful tech tip about {topic}. The goal is to provide immediate value to our followers and establish authority in the {industry} space.',
    author: 'Alice Johnson',
    createdAt: '2024-03-12',
    updatedAt: '2024-03-12'
  }
];
