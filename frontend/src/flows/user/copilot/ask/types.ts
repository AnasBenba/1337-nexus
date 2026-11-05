import { Citation } from '@/lib/sse-client';

export type MessageRole = 'user' | 'assistant';

export type CopilotStatus = 
  | 'idle'
  | 'sending'
  | 'retrieving'
  | 'streaming'
  | 'completed'
  | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status?: CopilotStatus;
  citations?: Citation[];
  tokens?: number;
}
