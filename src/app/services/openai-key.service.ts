import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OpenAiKey, OpenAiKeyCreateRequest } from '../models/openai-key.model';
import { buildUrl, buildUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class OpenaiKeyService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<OpenAiKey[]> {
    const token = this.requireToken();
    return this.http.get<OpenAiKey[]>(buildUrl('/openai-key/', token + '/list'));
  }

  create(payload: OpenAiKeyCreateRequest): Observable<OpenAiKey> {
    const token = this.requireToken();
    return this.http.post<OpenAiKey>(buildUrl('/openai-key/', token), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildUrlWithId('/openai-key/', token, id));
  }
}
