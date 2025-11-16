export type RunStatus = 'queued' | 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled';

export interface Run {
  id: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  thread: string;
  assistant: string;
  required_action?: RequiredAction;
}

export interface RunCreateRequest {
  thread_id: string;
  assistant_id: string;
  instructions?: string;
  metadata?: Record<string, unknown>;
  mode?: 'normal' | 'document' | 'web';
}

export interface RequiredAction {
  type: 'submit_tool_outputs';
  submit_tool_outputs: {
    tool_calls: ToolCall[];
  };
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}
