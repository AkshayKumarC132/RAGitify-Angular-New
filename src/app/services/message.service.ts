import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageCreateRequest, MessageItem, MessageRole } from '../models/message.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class MessageService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(threadId: string): Observable<MessageItem[]> {
    const token = this.requireToken();
    return this.http
      .get<unknown[]>(buildTokenUrlWithId('thread', token, threadId, 'messages'))
      .pipe(map(messages => messages.map(message => this.normaliseMessage(message))));
  }

  listAll(threadId?: string): Observable<MessageItem[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (threadId) {
      params = params.set('thread_id', threadId);
    }
    return this.http
      .get<unknown[]>(buildTokenUrl('message', token, 'list'), { params })
      .pipe(map(messages => messages.map(message => this.normaliseMessage(message))));
  }

  create(payload: MessageCreateRequest): Observable<MessageItem> {
    const token = this.requireToken();
    return this.http
      .post<unknown>(buildTokenUrl('message', token), payload)
      .pipe(map(message => this.normaliseMessage(message, payload.content)));
  }

  delete(id: number): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('message', token, id));
  }

  private normaliseMessage(message: unknown, fallbackContent?: string): MessageItem {
    const record = (message ?? {}) as Record<string, unknown>;
    const id = this.extractId(record);
    const role = this.extractRole(record);
    const thread = this.extractThreadId(record);
    const user = this.extractUser(record);
    const createdAt = this.extractCreatedAt(record);
    const content = this.extractContent(record, fallbackContent);

    return {
      id,
      role,
      thread,
      user,
      created_at: createdAt,
      content
    };
  }

  private extractId(record: Record<string, unknown>): number {
    const rawId = record['id'] ?? record['pk'];
    if (typeof rawId === 'number') {
      return rawId;
    }
    if (typeof rawId === 'string') {
      const parsed = Number(rawId);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return Date.now();
  }

  private extractRole(record: Record<string, unknown>): MessageRole {
    const rawRole = record['role'];
    if (rawRole === 'user' || rawRole === 'assistant' || rawRole === 'tool') {
      return rawRole;
    }
    return 'assistant';
  }

  private extractThreadId(record: Record<string, unknown>): string {
    const candidate = record['thread'] ?? record['thread_id'] ?? record['threadId'];
    if (candidate === null || candidate === undefined) {
      return '';
    }
    if (typeof candidate === 'object') {
      if (candidate && typeof (candidate as Record<string, unknown>)['id'] !== 'undefined') {
        const nested = (candidate as Record<string, unknown>)['id'];
        return nested !== undefined && nested !== null ? String(nested) : '';
      }
      return '';
    }
    return String(candidate);
  }

  private extractUser(record: Record<string, unknown>): string {
    const candidate = record['user'] ?? record['username'] ?? record['user_id'];
    if (candidate === null || candidate === undefined) {
      return '';
    }
    if (typeof candidate === 'object') {
      const nestedRecord = candidate as Record<string, unknown>;
      const username = nestedRecord['username'] ?? nestedRecord['email'] ?? nestedRecord['id'];
      return username !== undefined && username !== null ? String(username) : '';
    }
    return String(candidate);
  }

  private extractCreatedAt(record: Record<string, unknown>): string {
    const candidate = record['created_at'] ?? record['createdAt'] ?? record['timestamp'];
    if (typeof candidate === 'string') {
      return candidate;
    }
    if (candidate instanceof Date) {
      return candidate.toISOString();
    }
    return new Date().toISOString();
  }

  private extractContent(record: Record<string, unknown>, fallbackContent?: string): string {
    const candidates = [
      record['content'],
      record['latest_content'],
      record['latest_content_text'],
      record['content_text'],
      record['body'],
      record['text'],
      record['summary'],
      record['message']
    ];

    for (const candidate of candidates) {
      const resolved = this.flattenContent(candidate);
      if (resolved) {
        return resolved;
      }
    }

    if (fallbackContent && fallbackContent.trim().length > 0) {
      return fallbackContent.trim();
    }

    return '';
  }

  private flattenContent(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed;
    }
    if (Array.isArray(value)) {
      const parts = value
        .map(item => this.flattenContent(item))
        .filter(part => part.length > 0);
      const joined = parts.join('\n\n').trim();
      return joined;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const directKeys = ['text', 'output_text', 'value', 'body'];
      for (const key of directKeys) {
        const candidate = record[key];
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          return candidate.trim();
        }
      }

      const nestedKeys = ['content', 'data', 'parts', 'values'];
      for (const key of nestedKeys) {
        if (key in record) {
          const nested = this.flattenContent(record[key]);
          if (nested) {
            return nested;
          }
        }
      }
    }

    return '';
  }
}
