import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Run, RunCreateRequest } from '../models/run.model';
import { buildUrl, buildUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class RunService extends BaseApiService {
  private readonly http = inject(HttpClient);

  create(payload: RunCreateRequest): Observable<Run> {
    const token = this.requireToken();
    return this.http.post<Run>(buildUrl('/run', token), payload);
  }

  retrieve(id: string): Observable<Run> {
    const token = this.requireToken();
    return this.http.get<Run>(buildUrlWithId('/run', token, id));
  }

  submitToolOutputs(id: string, outputs: unknown): Observable<Run> {
    const token = this.requireToken();
    return this.http.post<Run>(buildUrlWithId('/run', token, id) + 'submit-tool-outputs/', outputs);
  }
}
