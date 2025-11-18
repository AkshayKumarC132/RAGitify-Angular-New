export type MessageRole = 'user' | 'assistant' | 'tool';

export interface MessageItem {
  id: number;
  thread: string;
  user: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface MessageCreateRequest {
  thread_id: string;
  content: string;
}
