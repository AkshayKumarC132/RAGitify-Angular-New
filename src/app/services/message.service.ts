import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MessageCreateRequest, MessageItem } from '../models/message.model';
import { buildUrl, buildUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class MessageService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(threadId: string): Observable<MessageItem[]> {
    const token = this.requireToken();
    return this.http.get<MessageItem[]>(buildUrlWithId('/thread', token, threadId) + 'messages/');
  }

  create(payload: MessageCreateRequest): Observable<MessageItem> {
    const token = this.requireToken();
    return this.http.post<MessageItem>(buildUrl('/message', token), payload);
  }
}
