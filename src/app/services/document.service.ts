import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DocumentIngestRequest, DocumentIngestResponse, DocumentItem, DocumentStatusResponse } from '../models/document.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(vectorStoreId?: string): Observable<DocumentItem[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (vectorStoreId) {
      params = params.set('vector_store_id', vectorStoreId);
    }
    return this.http.get<DocumentItem[] | { results: DocumentItem[] }>(buildTokenUrl('document', token, 'list'), { params }).pipe(
      // Some backends wrap list results; normalize so the UI always receives a flat array.
      map(response => (Array.isArray(response) ? response : response?.results ?? []))
    );
  }

  ingest(request: DocumentIngestRequest): Observable<DocumentIngestResponse> {
    const token = this.requireToken();
    const hasFile = Boolean(request.file);
    const hasUrl = Boolean(request.s3_file_url);
    if ((hasFile && hasUrl) || (!hasFile && !hasUrl)) {
      throw new Error('Exactly one of file or s3_file_url must be provided');
    }
    const formData = new FormData();
    formData.append('vector_store_id', request.vector_store_id);
    if (request.file) {
      formData.append('file', request.file);
    }
    if (request.s3_file_url) {
      formData.append('s3_file_url', request.s3_file_url);
    }
    return this.http.post<DocumentIngestResponse>(buildTokenUrl('document', token, 'ingest'), formData);
  }

  retrieve(id: string): Observable<DocumentItem> {
    const token = this.requireToken();
    return this.http.get<DocumentItem>(buildTokenUrlWithId('document', token, id));
  }

  update(id: string, payload: Partial<Pick<DocumentItem, 'title' | 'status'>>): Observable<DocumentItem> {
    const token = this.requireToken();
    return this.http.patch<DocumentItem>(buildTokenUrlWithId('document', token, id), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('document', token, id));
  }

  status(id: string): Observable<DocumentStatusResponse> {
    const token = this.requireToken();
    return this.http.get<DocumentStatusResponse>(buildTokenUrlWithId('document', token, id, 'status'));
  }
}
