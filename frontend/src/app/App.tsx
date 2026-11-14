import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { DiscoverPage } from '@/flows/user/discover/DiscoverPage';
import { ProjectsPage } from '@/flows/user/projects/ProjectsPage';
import { ProjectFormPage } from '@/flows/user/projects/create_project/ProjectFormPage';
import { RecommendedProjectsPage } from '@/flows/user/projects/recommended_projects/RecommendedProjectsPage';
import { RecruitmentReviewPage } from '@/flows/user/projects/RecruitmentReviewPage';
import { BoardPage } from '@/flows/user/board/BoardPage';
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
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="opportunities" element={<DiscoverPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<ProjectFormPage />} />
          <Route path="projects/:projectId/edit" element={<ProjectFormPage />} />
          <Route path="projects/recommended" element={<RecommendedProjectsPage />} />
          <Route path="projects/:projectId/recruitment" element={<RecruitmentReviewPage />} />
          <Route path="boards/:boardId" element={<BoardPage />} />
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
