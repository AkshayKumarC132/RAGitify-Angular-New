export type DocumentStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'error';

export interface DocumentItem {
  id: string;
  title: string;
  vector_store: string;
  user: string;
  uploaded_at: string;
  status: DocumentStatus;
}

export interface DocumentIngestRequest {
  vector_store_id: string;
  file?: File;
  s3_file_url?: string;
}

export interface DocumentIngestResponse {
  message: string;
  file_name: string;
  document_id: string;
  vector_store_id: string;
  status: DocumentStatus;
}

export interface DocumentStatusResponse {
  document_id: string;
  status: DocumentStatus;
  qdrant_points: number;
}
