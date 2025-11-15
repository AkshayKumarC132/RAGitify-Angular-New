export type OpenAiProvider = 'OpenAI' | 'Ollama';

export interface OpenAiKey {
  id: number;
  name: string;
  provider: OpenAiProvider;
  model: string;
  is_valid: boolean;
  is_active: boolean;
  created_at: string;
  masked_key?: string;
}

export interface OpenAiKeyCreateRequest {
  name: string;
  provider: OpenAiProvider;
  model?: string;
  api_key?: string;
  is_active?: boolean;
}
