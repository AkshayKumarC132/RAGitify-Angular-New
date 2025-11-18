export interface DocumentAlert {
  id: number;
  document: number;
  user: string;
  keyword: string;
  snippet?: string;
  created_at: string;
}

export interface DocumentAlertCreateRequest {
  document: number;
  keyword: string;
  snippet?: string;
}
