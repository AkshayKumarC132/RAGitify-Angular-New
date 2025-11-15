import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Assistant, AssistantCreateRequest } from '../models/assistant.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class AssistantService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<Assistant[]> {
    const token = this.requireToken();
    return this.http.get<Assistant[]>(buildTokenUrl('assistant', token, 'list'));
  }

  create(payload: AssistantCreateRequest): Observable<Assistant> {
    const token = this.requireToken();
    return this.http.post<Assistant>(buildTokenUrl('assistant', token), payload);
  }

  retrieve(id: string): Observable<Assistant> {
    const token = this.requireToken();
    return this.http.get<Assistant>(buildTokenUrlWithId('assistant', token, id));
  }

  update(id: string, payload: Partial<AssistantCreateRequest>): Observable<Assistant> {
    const token = this.requireToken();
    return this.http.patch<Assistant>(buildTokenUrlWithId('assistant', token, id), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('assistant', token, id));
  }
}
