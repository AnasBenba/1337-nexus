import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { RefineProjectDemoPage } from '@/flows/user/projects/refine_project';
import { ProfilePage } from '@/flows/user/profile';
import { FriendsPage } from '@/flows/user/friends';
import { AdminUsersPage } from '@/flows/admin/users';
import Login from './authentication/login/Login';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/copilot" replace />} />
          <Route path="copilot" element={<CopilotPage />} />
          <Route path="user/copilot/ask" element={<CopilotPage />} />
          <Route path="refine-project" element={<RefineProjectDemoPage />} />
          <Route path="projects/refine-project" element={<RefineProjectDemoPage />} />
          <Route path="users/:login" element={<ProfilePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="*" element={<Navigate to="/copilot" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
