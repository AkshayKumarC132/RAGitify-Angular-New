export interface VectorStore {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface VectorStoreCreateRequest {
  name: string;
  description?: string;
}
