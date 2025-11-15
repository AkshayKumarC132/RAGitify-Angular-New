import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Assistant, AssistantCreateRequest } from '../models/assistant.model';
import { buildUrl, buildUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class AssistantService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<Assistant[]> {
    const token = this.requireToken();
    return this.http.get<Assistant[]>(buildUrl('/assistant/', token+'/list'));
  }

  create(payload: AssistantCreateRequest): Observable<Assistant> {
    const token = this.requireToken();
    return this.http.post<Assistant>(buildUrl('/assistant/', token), payload);
  }

  update(id: string, payload: Partial<AssistantCreateRequest>): Observable<Assistant> {
    const token = this.requireToken();
    return this.http.put<Assistant>(buildUrlWithId('/assistant/', token, id), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildUrlWithId('/assistant/', token, id));
  }
}
