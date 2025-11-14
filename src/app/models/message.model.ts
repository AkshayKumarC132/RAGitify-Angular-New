export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageItem {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  thread: string;
  run?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MessageCreateRequest {
  thread_id: string;
  role: Extract<MessageRole, 'user' | 'system'>;
  content: string;
  metadata?: Record<string, unknown>;
}
