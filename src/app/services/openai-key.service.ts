import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OpenAiKey, OpenAiKeyCreateRequest } from '../models/openai-key.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class OpenaiKeyService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<OpenAiKey[]> {
    const token = this.requireToken();
    return this.http.get<OpenAiKey[]>(buildTokenUrl('openai-key', token, 'list'));
  }

  create(payload: OpenAiKeyCreateRequest): Observable<OpenAiKey> {
    const token = this.requireToken();
    return this.http.post<OpenAiKey>(buildTokenUrl('openai-key', token), payload);
  }

  retrieve(id: number): Observable<OpenAiKey> {
    const token = this.requireToken();
    return this.http.get<OpenAiKey>(buildTokenUrlWithId('openai-key', token, id));
  }

  update(id: number, payload: Partial<OpenAiKeyCreateRequest>): Observable<OpenAiKey> {
    const token = this.requireToken();
    return this.http.patch<OpenAiKey>(buildTokenUrlWithId('openai-key', token, id), payload);
  }

  delete(id: number): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('openai-key', token, id));
  }
}
