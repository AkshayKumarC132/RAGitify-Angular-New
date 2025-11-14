export interface ThreadItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  vector_store?: string | null;
  assistant?: string | null;
}

export interface ThreadCreateRequest {
  title?: string;
  assistant_id?: string;
  vector_store_id?: string;
}
