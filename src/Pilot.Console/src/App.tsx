import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import CampaignsPage from './pages/Campaigns';
import ScheduledPostsPage from './pages/ScheduledPosts';
import CampaignProfilePage from './pages/CampaignProfile';
import CampaignFormPage from './pages/CampaignForm';
import PostFormPage from './pages/PostForm';
import BatchActionPage from './pages/BatchAction';
import BatchCreatePage from './pages/BatchCreate';
import ChannelsPage from './pages/Channels';
import UsersPage from './pages/Users';
import PromptsPage from './pages/Prompts';
import PromptFormPage from './pages/PromptForm';
import AiTasksPage from './pages/AiTasks';
import CampaignHistoryPage from './pages/CampaignHistory';
import GlobalHistoryPage from './pages/GlobalHistory';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeProvider as NextThemeProvider } from 'next-themes';

export default function App() {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/profile" element={<ProfilePage />} />
                          <Route path="/campaigns" element={<CampaignsPage />} />
                          <Route path="/scheduled-posts" element={<ScheduledPostsPage />} />
                          <Route path="/campaigns/new" element={<CampaignFormPage />} />
                          <Route path="/campaigns/edit/:id" element={<CampaignFormPage />} />
                          <Route path="/campaigns/:id" element={<CampaignProfilePage />} />
                          <Route path="/campaigns/:id/history" element={<CampaignHistoryPage />} />
                          <Route path="/campaigns/:id/batch" element={<BatchActionPage />} />
                          <Route path="/campaigns/:id/batch/create" element={<BatchCreatePage />} />
                          <Route path="/campaigns/:campaignId/posts/new" element={<PostFormPage />} />
                          <Route path="/campaigns/:campaignId/posts/edit/:postId" element={<PostFormPage />} />
                          <Route path="/channels" element={<ChannelsPage />} />
                          <Route path="/prompts" element={<PromptsPage />} />
                          <Route path="/prompts/new" element={<PromptFormPage />} />
                          <Route path="/prompts/edit/:id" element={<PromptFormPage />} />
                          <Route path="/ai-tasks" element={<AiTasksPage />} />
                          <Route path="/users" element={<UsersPage />} />
                          <Route path="/history" element={<GlobalHistoryPage />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Router>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </NextThemeProvider>
  );
}
