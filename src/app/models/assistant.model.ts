export interface Assistant {
  id: string;
  name: string;
  instructions?: string;
  model?: string;
  tools?: AssistantTool[];
  vector_store_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantCreateRequest {
  name: string;
  instructions?: string;
  model?: string;
  vector_store_id?: string;
  tools?: AssistantTool[];
}

export type AssistantTool = FileSearchTool | FunctionTool;

export interface FileSearchTool {
  type: 'file_search';
  file_search: {
    ranking_options?: {
      ranker?: string;
      score_threshold?: number;
    };
  };
}

export interface FunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}
