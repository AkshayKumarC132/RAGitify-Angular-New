export interface OpenAiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string;
  masked_key: string;
}

export interface OpenAiKeyCreateRequest {
  name: string;
  key: string;
}
