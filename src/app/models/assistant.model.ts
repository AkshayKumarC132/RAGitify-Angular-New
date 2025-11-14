export interface Assistant {
  id: string;
  name: string;
  instructions: string;
  model: string;
  vector_store?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantCreateRequest {
  name: string;
  instructions: string;
  model: string;
  vector_store?: string;
}
