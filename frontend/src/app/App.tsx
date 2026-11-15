import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { DiscoverPage } from '@/flows/user/discover/DiscoverPage';
import { OpportunitiesPage } from '@/flows/user/opportunities/OpportunitiesPage';
import { OpportunityApplicantsPage } from '@/flows/user/opportunities/OpportunityApplicantsPage';
import { OpportunityWorkspacePage } from '@/flows/user/opportunities/OpportunityWorkspacePage';
import { WhiteboardPage } from '@/flows/user/canvas';
import { BoardPage } from '@/flows/user/board/BoardPage';
import { RefineProjectDemoPage } from '@/flows/user/projects/refine_project';
import { ProfilePage } from '@/flows/user/profile';
import { FriendsPage } from '@/flows/user/friends';
import { AdminUsersPage } from '@/flows/admin/users';
import { ChatPage } from '@/flows/user/chat/ChatPage';
import { CreatePitchPage } from '@/flows/user/pitches/CreatePitchPage';
import { HomePitchFeedPage } from '@/flows/user/pitches/HomePitchFeedPage';
import Login from './authentication/login/Login';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePitchFeedPage />} />
          <Route path="home" element={<HomePitchFeedPage />} />
          <Route path="pitches" element={<CreatePitchPage />} />
          <Route path="pitches/new" element={<CreatePitchPage />} />
          <Route path="copilot" element={<CopilotPage />} />
          <Route path="user/copilot/ask" element={<CopilotPage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="opportunities" element={<OpportunitiesPage />} />
          <Route path="opportunities/:opportunityId/applications" element={<OpportunityApplicantsPage />} />
          <Route path="opportunities/:opportunityId/workspace" element={<OpportunityWorkspacePage />} />
          <Route path="whiteboard" element={<WhiteboardPage />} />
          <Route path="projects/*" element={<Navigate to="/opportunities" replace />} />
          <Route path="boards/:boardId" element={<BoardPage />} />
          <Route path="refine-project" element={<RefineProjectDemoPage />} />
          <Route path="messages" element={<ChatPage />} />
          <Route path="chat" element={<Navigate to="/messages" replace />} />
          <Route path="users/:login" element={<ProfilePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
