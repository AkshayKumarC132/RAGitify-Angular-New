import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MessageCreateRequest, MessageItem } from '../models/message.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class MessageService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(threadId: string): Observable<MessageItem[]> {
    const token = this.requireToken();
    return this.http.get<MessageItem[]>(buildTokenUrlWithId('thread', token, threadId, 'messages'));
  }

  listAll(threadId?: string): Observable<MessageItem[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (threadId) {
      params = params.set('thread_id', threadId);
    }
    return this.http.get<MessageItem[]>(buildTokenUrl('message', token, 'list'), { params });
  }

  create(payload: MessageCreateRequest): Observable<MessageItem> {
    const token = this.requireToken();
    return this.http.post<MessageItem>(buildTokenUrl('message', token), payload);
  }

  delete(id: number): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('message', token, id));
  }
}
