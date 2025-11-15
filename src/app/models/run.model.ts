export type RunStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'requires_action'
  | 'cancelled';

export type RunMode = 'document' | 'normal' | 'web';

export interface Run {
  id: string;
  thread: string;
  assistant: string;
  status: RunStatus;
  mode: RunMode;
  required_action?: RequiredAction | null;
  created_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  source_run_id?: string | null;
  source_message_id?: number | null;
  rerun_of_id?: string | null;
}

export interface RunCreateRequest {
  thread_id: string;
  assistant_id: string;
  mode?: RunMode;
  message_id?: number;
  source_run_id?: string;
  queries?: string[];
  filters?: Record<string, unknown>;
  tool_outputs?: ToolOutput[];
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
  function?: {
    name: string;
    description?: string;
    arguments: string;
  };
}

export interface ToolOutput {
  tool_call_id: string;
  output: string;
}
