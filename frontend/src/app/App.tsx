import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { RefineProjectDemoPage } from '@/flows/user/projects/refine_project';
import { WhiteboardPage } from '@/flows/user/canvas';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/copilot" replace />} />
            <Route path="copilot" element={<CopilotPage />} />
            <Route path="user/copilot/ask" element={<CopilotPage />} />
            <Route path="refine-project" element={<RefineProjectDemoPage />} />
            <Route path="projects/refine-project" element={<RefineProjectDemoPage />} />
            <Route path="whiteboard" element={<WhiteboardPage />} />
            <Route path="canvas" element={<WhiteboardPage />} />
            <Route path="*" element={<Navigate to="/copilot" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
