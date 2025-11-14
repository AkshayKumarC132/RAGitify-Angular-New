import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VectorStore, VectorStoreCreateRequest } from '../models/vector-store.model';
import { buildUrl, buildUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class VectorStoreService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<VectorStore[]> {
    const token = this.requireToken();
    return this.http.get<VectorStore[]>(buildUrl('/vector-store', token));
  }

  create(payload: VectorStoreCreateRequest): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http.post<VectorStore>(buildUrl('/vector-store', token), payload);
  }

  retrieve(id: string): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http.get<VectorStore>(buildUrlWithId('/vector-store', token, id));
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildUrlWithId('/vector-store', token, id));
  }
}
