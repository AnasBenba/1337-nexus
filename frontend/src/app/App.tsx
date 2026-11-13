import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/Layout';
import Login from '@/app/authentication/login/Login';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { ChatPage } from '@/flows/user/chat/ChatPage';
import { DiscoverPage } from '@/flows/user/opportunities/DiscoverPage';
import { PitchesPage } from '@/flows/user/pitches';
import {
  MyProjectsPage,
  OpportunityDetailsPage,
  ProjectWorkspacePage,
} from '@/flows/user/projects';
import { WhiteboardPage } from '@/flows/user/canvas';
import { ProfilePage } from '@/flows/user/profile/ProfilePage';
import { TermsPage } from '@/flows/legal/TermsPage';
import { PrivacyPage } from '@/flows/legal/PrivacyPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone Soufiane Login / Signup / 42 OAuth Page */}
          <Route path="/login" element={<Login />} />

          {/* Main Application Layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/discover" replace />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="pitches" element={<PitchesPage />} />
            <Route path="refine-project" element={<Navigate to="/pitches" replace />} />
            <Route path="projects/refine-project" element={<Navigate to="/pitches" replace />} />
            <Route path="my-projects" element={<MyProjectsPage />} />
            <Route path="my-projects/:opportunityId" element={<OpportunityDetailsPage />} />
            <Route
              path="my-projects/:opportunityId/workspace"
              element={<ProjectWorkspacePage />}
            />
            <Route path="whiteboard" element={<WhiteboardPage />} />
            <Route path="canvas" element={<WhiteboardPage />} />
            <Route path="copilot" element={<CopilotPage />} />
            <Route path="user/copilot/ask" element={<CopilotPage />} />
            <Route path="messages" element={<ChatPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="users/:login" element={<ProfilePage />} />
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
