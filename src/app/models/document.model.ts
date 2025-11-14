export interface DocumentItem {
  id: string;
  name: string;
  source: 'upload' | 's3';
  size_bytes: number;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
  vector_store?: string | null;
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentIngestRequest {
  vector_store_id: string;
  document?: File;
  s3_url?: string;
}

export interface DocumentStatusResponse {
  id: string;
  status: DocumentStatus;
  processed_at?: string;
  error_message?: string;
}
