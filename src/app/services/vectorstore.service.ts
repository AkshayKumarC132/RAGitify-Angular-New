import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VectorStore, VectorStoreCreateRequest, VectorStoreUpdateRequest } from '../models/vector-store.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class VectorStoreService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<VectorStore[]> {
    const token = this.requireToken();
    return this.http.get<VectorStore[]>(buildTokenUrl('vector-store', token, 'list'));
  }

  create(payload: VectorStoreCreateRequest): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http.post<VectorStore>(buildTokenUrl('vector-store', token), payload);
  }

  retrieve(id: string): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http.get<VectorStore>(buildTokenUrlWithId('vector-store', token, id));
  }

  update(id: string, payload: VectorStoreUpdateRequest): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http.patch<VectorStore>(buildTokenUrlWithId('vector-store', token, id), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('vector-store', token, id));
  }
}
