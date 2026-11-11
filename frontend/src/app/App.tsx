import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { RefineProjectDemoPage } from '@/flows/user/projects/refine_project';
import { ChatPage } from '@/flows/user/chat/ChatPage';
import { DiscoverPage } from '@/flows/user/opportunities/DiscoverPage';
import { WhiteboardPage } from '@/flows/user/canvas';
import { ProfilePage } from '@/flows/user/profile/ProfilePage';
import { TermsPage } from '@/flows/legal/TermsPage';
import { PrivacyPage } from '@/flows/legal/PrivacyPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/discover" replace />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="whiteboard" element={<WhiteboardPage />} />
            <Route path="canvas" element={<WhiteboardPage />} />
            <Route path="refine-project" element={<RefineProjectDemoPage />} />
            <Route path="projects/refine-project" element={<RefineProjectDemoPage />} />
            <Route path="copilot" element={<CopilotPage />} />
            <Route path="user/copilot/ask" element={<CopilotPage />} />
            <Route path="messages" element={<ChatPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
