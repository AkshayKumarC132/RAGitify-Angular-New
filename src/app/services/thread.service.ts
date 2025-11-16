import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ThreadCreateRequest, ThreadItem } from '../models/thread.model';
import { buildUrl, buildUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class ThreadService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(vectorStoreId?: string): Observable<ThreadItem[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (vectorStoreId) {
      params = params.set('vector_store', vectorStoreId);
    }
    return this.http.get<ThreadItem[]>(buildUrl('/thread/', token + '/list'), { params });
  }

  create(payload: ThreadCreateRequest): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http.post<ThreadItem>(buildUrl('/thread/', token), payload);
  }

  retrieve(id: string): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http.get<ThreadItem>(buildUrlWithId('/thread/', token, id));
  }
}
