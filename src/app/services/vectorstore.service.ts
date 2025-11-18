import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { VectorStore, VectorStoreCreateRequest, VectorStoreUpdateRequest } from '../models/vector-store.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class VectorStoreService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<VectorStore[]> {
    const token = this.requireToken();
    return this.http
      .get<VectorStore[] | { results: VectorStore[] }>(buildTokenUrl('vector-store', token, 'list'))
      .pipe(
        map(response => (Array.isArray(response) ? response : response?.results ?? [])),
        map(list => list.map(item => this.normalise(item)))
      );
  }

  create(payload: VectorStoreCreateRequest): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http
      .post<VectorStore>(buildTokenUrl('vector-store', token), payload)
      .pipe(map(item => this.normalise(item)));
  }

  retrieve(id: string): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http
      .get<VectorStore>(buildTokenUrlWithId('vector-store', token, id))
      .pipe(map(item => this.normalise(item)));
  }

  update(id: string, payload: VectorStoreUpdateRequest): Observable<VectorStore> {
    const token = this.requireToken();
    return this.http
      .patch<VectorStore>(buildTokenUrlWithId('vector-store', token, id), payload)
      .pipe(map(item => this.normalise(item)));
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('vector-store', token, id));
  }

  private normalise(raw: unknown): VectorStore {
    const record = (raw ?? {}) as Record<string, unknown>;

    const id = record['id'] ?? record['uuid'] ?? record['pk'];
    const name = record['name'] ?? record['title'] ?? 'Untitled Vector Store';
    const user = record['user'] ?? record['owner'] ?? '';
    const created = record['created_at'] ?? record['createdAt'] ?? new Date().toISOString();

    return {
      id: id !== undefined && id !== null ? String(id) : '',
      name: typeof name === 'string' ? name : String(name ?? ''),
      user: typeof user === 'string' ? user : String(user ?? ''),
      created_at: typeof created === 'string' ? created : new Date().toISOString()
    };
  }
}
