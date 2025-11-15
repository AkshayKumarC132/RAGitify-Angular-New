export interface DocumentAccess {
  id: number;
  document: string;
  vector_store: string;
  granted_by: number;
  granted_at: string;
}

export interface DocumentAccessCreateRequest {
  vector_store_id: string;
  document_ids: string[];
}

export type DocumentAccessRemoveRequest = DocumentAccessCreateRequest;

export interface DocumentAccessGrantResponse {
  message: string;
  access_details: Array<{
    document_id: string;
    vector_store_id: string;
    created: boolean;
  }>;
}

export interface DocumentAccessRemoveResponse {
  message: string;
  removed_document_ids_count: number;
}
