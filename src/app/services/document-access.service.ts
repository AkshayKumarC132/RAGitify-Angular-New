import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DocumentAccess,
  DocumentAccessCreateRequest,
  DocumentAccessGrantResponse,
  DocumentAccessRemoveRequest,
  DocumentAccessRemoveResponse
} from '../models/document-access.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentAccessService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<DocumentAccess[]> {
    const token = this.requireToken();
    return this.http.get<DocumentAccess[]>(buildTokenUrl('document-access', token, 'list'));
  }

  create(payload: DocumentAccessCreateRequest): Observable<DocumentAccessGrantResponse> {
    const token = this.requireToken();
    return this.http.post<DocumentAccessGrantResponse>(buildTokenUrl('document-access', token), payload);
  }

  remove(payload: DocumentAccessRemoveRequest): Observable<DocumentAccessRemoveResponse> {
    const token = this.requireToken();
    return this.http.put<DocumentAccessRemoveResponse>(buildTokenUrl('document-access/remove', token), payload);
  }

  delete(id: number): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('document-access', token, id));
  }
}
