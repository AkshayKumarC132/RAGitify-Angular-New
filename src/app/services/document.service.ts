import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentIngestRequest, DocumentItem, DocumentStatusResponse } from '../models/document.model';
import { buildUrl, buildUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<DocumentItem[]> {
    const token = this.requireToken();
    return this.http.get<DocumentItem[]>(buildUrl('/document', token));
  }

  ingest(request: DocumentIngestRequest): Observable<DocumentItem> {
    const token = this.requireToken();
    const formData = new FormData();
    formData.append('vector_store_id', request.vector_store_id);
    if (request.document) {
      formData.append('document', request.document);
    }
    if (request.s3_url) {
      formData.append('s3_url', request.s3_url);
    }
    return this.http.post<DocumentItem>(buildUrl('/document', token) + 'ingest/', formData);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildUrlWithId('/document', token, id));
  }

  status(id: string): Observable<DocumentStatusResponse> {
    const token = this.requireToken();
    return this.http.get<DocumentStatusResponse>(buildUrlWithId('/document', token, id) + 'status/');
  }
}
