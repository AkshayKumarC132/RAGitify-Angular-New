import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  DocumentIngestRequest,
  DocumentIngestResponse,
  DocumentItem,
  DocumentStatus,
  DocumentStatusResponse
} from '../models/document.model';
import { buildTokenUrl, buildTokenUrlWithId } from '../utils/api-url';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class DocumentService extends BaseApiService {
  private readonly http = inject(HttpClient);

  list(vectorStoreId?: string): Observable<DocumentItem[]> {
    const token = this.requireToken();
    let params = new HttpParams();
    if (vectorStoreId) {
      params = params.set('vector_store_id', vectorStoreId);
    }
    return this.http
      .get<DocumentItem[] | { results: DocumentItem[] }>(buildTokenUrl('document', token, 'list'), { params })
      .pipe(
        // Some backends wrap list results; normalize so the UI always receives a flat array.
        map(response => (Array.isArray(response) ? response : response?.results ?? [])),
        map(list => list.map(item => this.normaliseDocument(item)))
      );
  }

  ingest(request: DocumentIngestRequest): Observable<DocumentIngestResponse> {
    const token = this.requireToken();
    const hasFile = Boolean(request.file);
    const hasUrl = Boolean(request.s3_file_url);
    if ((hasFile && hasUrl) || (!hasFile && !hasUrl)) {
      throw new Error('Exactly one of file or s3_file_url must be provided');
    }
    const formData = new FormData();
    formData.append('vector_store_id', request.vector_store_id);
    if (request.file) {
      formData.append('file', request.file);
    }
    if (request.s3_file_url) {
      formData.append('s3_file_url', request.s3_file_url);
    }
    return this.http.post<DocumentIngestResponse>(buildTokenUrl('document', token, 'ingest'), formData);
  }

  retrieve(id: string): Observable<DocumentItem> {
    const token = this.requireToken();
    return this.http.get<DocumentItem>(buildTokenUrlWithId('document', token, id));
  }

  update(id: string, payload: Partial<Pick<DocumentItem, 'title' | 'status'>>): Observable<DocumentItem> {
    const token = this.requireToken();
    return this.http.patch<DocumentItem>(buildTokenUrlWithId('document', token, id), payload);
  }

  delete(id: string): Observable<void> {
    const token = this.requireToken();
    return this.http.delete<void>(buildTokenUrlWithId('document', token, id));
  }

  status(id: string): Observable<DocumentStatusResponse> {
    const token = this.requireToken();
    return this.http.get<DocumentStatusResponse>(buildTokenUrlWithId('document', token, id, 'status'));
  }

  private normaliseDocument(raw: unknown): DocumentItem {
    const record = (raw ?? {}) as Record<string, unknown>;
    const id = this.extractId(record);
    const title = this.extractTitle(record);
    const vectorStore = this.extractVectorStoreId(record);
    const uploadedAt = this.extractDate(record);
    const status = this.extractStatus(record);

    return {
      id,
      title,
      vector_store: vectorStore,
      user: (record['user'] as string) ?? '',
      uploaded_at: uploadedAt,
      status
    };
  }

  private extractId(record: Record<string, unknown>): string {
    const candidate = record['id'] ?? record['uuid'] ?? record['pk'];
    return candidate !== undefined && candidate !== null ? String(candidate) : '';
  }

  private extractTitle(record: Record<string, unknown>): string {
    const candidate = record['title'] ?? record['name'] ?? 'Untitled document';
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed.length ? trimmed : 'Untitled document';
    }
    return String(candidate);
  }

  private extractVectorStoreId(record: Record<string, unknown>): string {
    const direct = record['vector_store'];
    const explicit = record['vector_store_id'];
    const nested = record['vector_store_id_read'] ?? record['vectorStore'] ?? record['vectorStoreId'];

    const candidate = direct ?? explicit ?? nested;
    if (candidate === null || candidate === undefined) {
      if (typeof direct === 'object' && direct !== null) {
        const nestedId = (direct as Record<string, unknown>)['id'];
        return nestedId !== undefined && nestedId !== null ? String(nestedId) : '';
      }
      return '';
    }

    if (typeof candidate === 'object') {
      const nestedId = (candidate as Record<string, unknown>)['id'];
      return nestedId !== undefined && nestedId !== null ? String(nestedId) : '';
    }

    return String(candidate);
  }

  private extractDate(record: Record<string, unknown>): string {
    const candidate = record['uploaded_at'] ?? record['created_at'] ?? record['createdAt'];
    if (typeof candidate === 'string') {
      return candidate;
    }
    if (candidate instanceof Date) {
      return candidate.toISOString();
    }
    return new Date().toISOString();
  }

  private extractStatus(record: Record<string, unknown>): DocumentStatus {
    const candidate = record['status'];
    const allowed: DocumentStatus[] = ['queued', 'processing', 'completed', 'failed', 'error'];
    if (typeof candidate === 'string' && allowed.includes(candidate as DocumentStatus)) {
      return candidate as DocumentStatus;
    }
    return 'queued';
  }

}
