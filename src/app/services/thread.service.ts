import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ThreadCreateRequest, ThreadItem } from '../models/thread.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class ThreadService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(vectorStoreId?: string): Observable<ThreadItem[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (vectorStoreId) {
      params = params.set('vector_store_id', vectorStoreId);
    }
    return this.http.get<ThreadItem[]>(buildTokenUrl('thread', token, 'list'), { params });
  }

  create(payload: ThreadCreateRequest): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http.post<ThreadItem>(buildTokenUrl('thread', token), payload);
  }

  retrieve(id: string): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http.get<ThreadItem>(buildTokenUrlWithId('thread', token, id));
  }

  update(id: string, payload: Partial<ThreadCreateRequest>): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http.patch<ThreadItem>(buildTokenUrlWithId('thread', token, id), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('thread', token, id));
  }
}
