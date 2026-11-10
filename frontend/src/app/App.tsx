import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { RefineProjectDemoPage } from '@/flows/user/projects/refine_project';
import { ChatPage } from '@/flows/user/chat/ChatPage';
import { FriendsPage } from '@/flows/user/friends/FriendsPage';
import { ProfilePage } from '@/flows/user/profile/ProfilePage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/copilot" replace />} />
          <Route path="copilot" element={<CopilotPage />} />
          <Route path="user/copilot/ask" element={<CopilotPage />} />
          <Route path="refine-project" element={<RefineProjectDemoPage />} />
          <Route path="projects/refine-project" element={<RefineProjectDemoPage />} />
          <Route path="messages" element={<ChatPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/copilot" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
