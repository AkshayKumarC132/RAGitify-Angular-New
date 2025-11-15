import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Run, RunCreateRequest, ToolOutput } from '../models/run.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class RunService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(threadId?: string): Observable<Run[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (threadId) {
      params = params.set('thread_id', threadId);
    }
    return this.http.get<Run[]>(buildTokenUrl('run', token, 'list'), { params });
  }

  create(payload: RunCreateRequest): Observable<Run> {
    const token = this.requireToken();
    return this.http.post<Run>(buildTokenUrl('run', token), payload);
  }

  retrieve(id: string): Observable<Run> {
    const token = this.requireToken();
    return this.http.get<Run>(buildTokenUrlWithId('run', token, id));
  }

  cancel(id: string): Observable<Run> {
    const token = this.requireToken();
    return this.http.post<Run>(buildTokenUrlWithId('run', token, id, 'cancel'), {});
  }

  rerun(id: string): Observable<Run> {
    const token = this.requireToken();
    return this.http.post<Run>(buildTokenUrlWithId('run', token, id, 'rerun'), {});
  }

  submitToolOutputs(id: string, tool_outputs: ToolOutput[]): Observable<Run> {
    const token = this.requireToken();
    return this.http.post<Run>(buildTokenUrlWithId('run', token, id, 'submit-tool-outputs'), { tool_outputs });
  }
}
