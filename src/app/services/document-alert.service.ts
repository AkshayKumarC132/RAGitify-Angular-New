import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentAlert, DocumentAlertCreateRequest } from '../models/document-alert.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentAlertService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(documentId?: string): Observable<DocumentAlert[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (documentId) {
      params = params.set('document_id', documentId);
    }
    return this.http.get<DocumentAlert[]>(buildTokenUrl('document-alert', token, 'list'), { params });
  }

  create(payload: DocumentAlertCreateRequest): Observable<DocumentAlert> {
    const token = this.requireToken();
    return this.http.post<DocumentAlert>(buildTokenUrl('document-alert', token), payload);
  }

  retrieve(id: number): Observable<DocumentAlert> {
    const token = this.requireToken();
    return this.http.get<DocumentAlert>(buildTokenUrlWithId('document-alert', token, id));
  }

  update(id: number, payload: Partial<DocumentAlertCreateRequest>): Observable<DocumentAlert> {
    const token = this.requireToken();
    return this.http.patch<DocumentAlert>(buildTokenUrlWithId('document-alert', token, id), payload);
  }

  delete(id: number): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('document-alert', token, id));
  }
}
