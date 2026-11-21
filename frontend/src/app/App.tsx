import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { DiscoverPage } from '@/flows/user/discover/DiscoverPage';
import { OpportunitiesPage } from '@/flows/user/opportunities/OpportunitiesPage';
import { OpportunityApplicantsPage } from '@/flows/user/opportunities/OpportunityApplicantsPage';
import { OpportunityWorkspacePage } from '@/flows/user/opportunities/OpportunityWorkspacePage';
import { WhiteboardPage } from '@/flows/user/canvas';
import { BoardPage } from '@/flows/user/board/BoardPage';
import { ProfilePage } from '@/flows/user/profile';
import { FriendsPage } from '@/flows/user/friends';
import { AdminUsersPage } from '@/flows/admin/users';
import { ChatPage } from '@/flows/user/chat/ChatPage';
import { CreatePitchPage } from '@/flows/user/pitches/CreatePitchPage';
import { HomePitchFeedPage } from '@/flows/user/pitches/HomePitchFeedPage';
import { PrivacyPage, TermsPage } from '@/flows/legal';
import Login from './authentication/login/Login';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctx = useOutletContext<{ me?: unknown }>();
  if (!ctx?.me) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePitchFeedPage />} />
          <Route path="home" element={<HomePitchFeedPage />} />
          <Route
            path="pitches"
            element={
              <RequireAuth>
                <CreatePitchPage />
              </RequireAuth>
            }
          />
          <Route
            path="pitches/new"
            element={
              <RequireAuth>
                <CreatePitchPage />
              </RequireAuth>
            }
          />
          <Route
            path="copilot"
            element={
              <RequireAuth>
                <CopilotPage />
              </RequireAuth>
            }
          />
          <Route
            path="user/copilot/ask"
            element={
              <RequireAuth>
                <CopilotPage />
              </RequireAuth>
            }
          />
          <Route path="discover" element={<DiscoverPage />} />
          <Route
            path="opportunities"
            element={
              <RequireAuth>
                <OpportunitiesPage />
              </RequireAuth>
            }
          />
          <Route
            path="opportunities/:opportunityId/applications"
            element={
              <RequireAuth>
                <OpportunityApplicantsPage />
              </RequireAuth>
            }
          />
          <Route
            path="opportunities/:opportunityId/workspace"
            element={
              <RequireAuth>
                <OpportunityWorkspacePage />
              </RequireAuth>
            }
          />
          <Route
            path="whiteboard"
            element={
              <RequireAuth>
                <WhiteboardPage />
              </RequireAuth>
            }
          />
          <Route path="projects/*" element={<Navigate to="/opportunities" replace />} />
          <Route
            path="boards/:boardId"
            element={
              <RequireAuth>
                <BoardPage />
              </RequireAuth>
            }
          />
          <Route
            path="messages"
            element={
              <RequireAuth>
                <ChatPage />
              </RequireAuth>
            }
          />
          <Route path="chat" element={<Navigate to="/messages" replace />} />
          <Route
            path="users/:login"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="friends"
            element={
              <RequireAuth>
                <FriendsPage />
              </RequireAuth>
            }
          />
          <Route
            path="admin/users"
            element={
              <RequireAuth>
                <AdminUsersPage />
              </RequireAuth>
            }
          />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
