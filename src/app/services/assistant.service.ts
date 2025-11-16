import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Assistant, AssistantCreateRequest } from '../models/assistant.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class AssistantService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<Assistant[]> {
    const token = this.requireToken();
    return this.http
      .get<Assistant[] | { results: Assistant[] }>(buildTokenUrl('assistant', token, 'list'))
      .pipe(
        map(response => (Array.isArray(response) ? response : response?.results ?? [])),
        map(items => items.map(item => this.normalizeAssistant(item)))
      );
  }

  create(payload: AssistantCreateRequest): Observable<Assistant> {
    const token = this.requireToken();
    return this.http
      .post<Assistant>(buildTokenUrl('assistant', token), payload)
      .pipe(map(item => this.normalizeAssistant(item, payload.vector_store_id)));
  }

  retrieve(id: string): Observable<Assistant> {
    const token = this.requireToken();
    return this.http
      .get<Assistant>(buildTokenUrlWithId('assistant', token, id))
      .pipe(map(item => this.normalizeAssistant(item)));
  }

  update(id: string, payload: Partial<AssistantCreateRequest>): Observable<Assistant> {
    const token = this.requireToken();
    return this.http
      .patch<Assistant>(buildTokenUrlWithId('assistant', token, id), payload)
      .pipe(map(item => this.normalizeAssistant(item)));
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('assistant', token, id));
  }

  private normalizeAssistant(assistant: Assistant, explicitStoreId?: string): Assistant {
    const resolvedId = explicitStoreId ?? this.resolveStoreId(assistant);
    if (!resolvedId) {
      return assistant;
    }
    return {
      ...assistant,
      vector_store: resolvedId,
      vector_store_id: resolvedId,
      vector_store_id_read: resolvedId
    };
  }

  private resolveStoreId(assistant: Assistant): string | null {
    return assistant.vector_store_id ?? assistant.vector_store_id_read ?? assistant.vector_store ?? null;
  }
}
