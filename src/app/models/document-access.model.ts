export interface DocumentAccess {
  id: string;
  document: string;
  assistant: string;
  created_at: string;
}

export interface DocumentAccessCreateRequest {
  assistant_id: string;
  document_ids: string[];
}
