import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentAccess, DocumentAccessCreateRequest } from '../models/document-access.model';
import { buildUrl } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentAccessService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<DocumentAccess[]> {
    const token = this.requireToken();
    return this.http.get<DocumentAccess[]>(buildUrl('/document-access', token));
  }

  create(payload: DocumentAccessCreateRequest): Observable<DocumentAccess[]> {
    const token = this.requireToken();
    return this.http.post<DocumentAccess[]>(buildUrl('/document-access', token), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(`${buildUrl('/document-access', token)}${id}/`);
  }
}
