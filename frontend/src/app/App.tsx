import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CopilotPage } from '@/flows/user/copilot/ask';
import { ChatPage } from '@/flows/user/chat/ChatPage';
import { CreatePitchPage } from '@/flows/user/pitches/CreatePitchPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/copilot" replace />} />
          <Route path="copilot" element={<CopilotPage />} />
          <Route path="user/copilot/ask" element={<CopilotPage />} />
          <Route path="refine-project" element={<Navigate to="/pitches/new" replace />} />
          <Route path="projects/refine-project" element={<Navigate to="/pitches/new" replace />} />
          <Route path="pitches/new" element={<CreatePitchPage />} />
          <Route path="messages" element={<ChatPage />} />
          <Route path="chat" element={<Navigate to="/messages" replace />} />
          <Route path="*" element={<Navigate to="/copilot" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
