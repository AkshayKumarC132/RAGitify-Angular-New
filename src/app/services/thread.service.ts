import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
    return this.http
      .get<unknown>(buildTokenUrl('thread', token, 'list'), { params })
      .pipe(map(response => this.extractThreadList(response).map(thread => this.normaliseThread(thread))));
  }

  create(payload: ThreadCreateRequest): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http
      .post<unknown>(buildTokenUrl('thread', token), payload)
      .pipe(map(thread => this.normaliseThread(thread)));
  }

  retrieve(id: string): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http
      .get<unknown>(buildTokenUrlWithId('thread', token, id))
      .pipe(map(thread => this.normaliseThread(thread)));
  }

  update(id: string, payload: Partial<ThreadCreateRequest>): Observable<ThreadItem> {
    const token = this.requireToken();
    return this.http
      .patch<unknown>(buildTokenUrlWithId('thread', token, id), payload)
      .pipe(map(thread => this.normaliseThread(thread)));
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('thread', token, id));
  }

  private extractThreadList(response: unknown): unknown[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && typeof response === 'object') {
      const record = response as Record<string, unknown>;
      const candidates = [record['results'], record['threads'], record['data'], record['items']];
      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          return candidate;
        }
      }
    }

    return [];
  }

  private normaliseThread(thread: unknown): ThreadItem {
    const record = (thread ?? {}) as Record<string, unknown>;
    const id = this.extractId(record);
    const title = this.extractTitle(record);
    const createdAt = this.extractCreatedAt(record);
    const vectorStoreId = this.extractVectorStoreId(record);

    return {
      id,
      title,
      created_at: createdAt,
      vector_store_id_read: vectorStoreId
    };
  }

  private extractId(record: Record<string, unknown>): string {
    const rawId = record['id'] ?? record['uuid'] ?? record['pk'];
    if (rawId === null || rawId === undefined) {
      return '';
    }
    return String(rawId);
  }

  private extractTitle(record: Record<string, unknown>): string | null {
    const rawTitle = record['title'] ?? record['name'];
    if (rawTitle === null || rawTitle === undefined) {
      return null;
    }
    if (typeof rawTitle === 'string') {
      const trimmed = rawTitle.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return String(rawTitle);
  }

  private extractCreatedAt(record: Record<string, unknown>): string {
    const candidate = record['created_at'] ?? record['createdAt'] ?? record['created'];
    if (typeof candidate === 'string') {
      return candidate;
    }
    if (candidate instanceof Date) {
      return candidate.toISOString();
    }
    return new Date().toISOString();
  }

  private extractVectorStoreId(record: Record<string, unknown>): string {
    const candidate =
      record['vector_store_id_read'] ??
      record['vector_store'] ??
      record['vector_store_id'] ??
      record['vectorStoreId'];

    if (candidate === null || candidate === undefined) {
      return '';
    }

    if (typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      const nestedId = nested['id'] ?? nested['uuid'];
      return nestedId !== undefined && nestedId !== null ? String(nestedId) : '';
    }

    return String(candidate);
  }
}
