import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { PitchesPage } from '@/flows/user/pitches';
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
            <Route path="pitches" element={<PitchesPage />} />
            <Route path="refine-project" element={<Navigate to="/pitches" replace />} />
            <Route path="projects/refine-project" element={<Navigate to="/pitches" replace />} />
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
