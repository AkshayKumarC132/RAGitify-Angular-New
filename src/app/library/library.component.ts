import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval, startWith, switchMap, takeWhile } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocumentService } from '../services/document.service';
import { DocumentItem, DocumentStatus } from '../models/document.model';
import { GlobalState } from '../state/global.state';
import { UploadProgressComponent } from './upload-progress.component';
import { NotificationService } from '../services/notification.service';
import { VectorStoreService } from '../services/vectorstore.service';
import { VectorStore } from '../models/vector-store.model';

interface IngestionTracker {
  documentId: string;
  fileName: string;
  status: DocumentStatus;
}

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, DatePipe, ReactiveFormsModule, UploadProgressComponent],
  template: `
    <div class="flex h-full flex-col gap-6 px-6 py-6">
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 class="text-lg font-semibold">Upload documents</h2>
        <p class="text-sm text-slate-400">Upload files or provide an S3 URL to ingest into a vector store.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2 space-y-2">
            <label class="text-sm text-slate-300">Target vector store</label>
            <select
              formControlName="vector_store_id"
              class="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            >
              <option value="" disabled>Select a vector store</option>
              <option *ngFor="let store of vectorStores()" [value]="store.id">{{ store.name }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-sm text-slate-300">File</label>
            <input
              type="file"
              (change)="handleFile($event)"
              class="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm text-slate-300">S3 URL</label>
            <input
              formControlName="s3_file_url"
              type="url"
              placeholder="https://..."
              class="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            />
          </div>
          <div class="md:col-span-2 flex justify-end">
            <button
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              type="submit"
              [disabled]="
                !state.workspaceReady() ||
                state.uploading() ||
                !form.value.vector_store_id ||
                (!selectedFile && !form.value.s3_file_url)
              "
            >
              Ingest document
            </button>
          </div>
        </form>
        <section class="mt-4 space-y-2" *ngIf="ingestions().length > 0">
          <article
            *ngFor="let item of ingestions()"
            class="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            <div>
              <p class="font-medium">{{ item.fileName }}</p>
              <p class="text-xs uppercase tracking-widest text-amber-200/70">{{ item.status | titlecase }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="relative flex h-3 w-3">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75"></span>
                <span class="relative inline-flex h-3 w-3 rounded-full bg-amber-400"></span>
              </span>
              <span class="text-xs text-amber-200/80">Processing…</span>
            </div>
          </article>
        </section>
        <app-upload-progress class="mt-4" [active]="state.uploading()"></app-upload-progress>
      </section>
      <section class="flex-1 rounded-2xl border border-white/10 bg-white/5 p-6">
        <header class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Documents</h2>
          <span class="text-sm text-slate-400">{{ documents().length }} items</span>
        </header>
        <div class="mt-4 overflow-x-auto">
          <table class="min-w-full divide-y divide-white/10 text-sm">
            <thead class="text-left text-slate-400">
              <tr>
                <th class="px-4 py-2 font-medium">Title</th>
                <th class="px-4 py-2 font-medium">Vector store</th>
                <th class="px-4 py-2 font-medium">Status</th>
                <th class="px-4 py-2 font-medium">Uploaded</th>
                <th class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documents()" class="border-b border-white/5">
                <td class="px-4 py-3">{{ doc.title }}</td>
                <td class="px-4 py-3 text-slate-300">{{ resolveStoreName(doc.vector_store) }}</td>
                <td class="px-4 py-3 capitalize" [class.text-emerald-400]="doc.status === 'completed'">{{ doc.status }}</td>
                <td class="px-4 py-3">{{ doc.uploaded_at | date: 'short' }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    (click)="remove(doc)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <ng-container *ngIf="documents().length === 0">
            <p *ngIf="state.workspaceReady(); else preparing" class="py-10 text-center text-sm text-slate-400">
              No documents yet.
            </p>
            <ng-template #preparing>
              <p class="py-10 text-center text-sm text-slate-400">Preparing your workspace…</p>
            </ng-template>
          </ng-container>
        </div>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LibraryComponent {
  private readonly documentService = inject(DocumentService);
  protected readonly state = inject(GlobalState);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly vectorStoreService = inject(VectorStoreService);

  readonly documents = signal<DocumentItem[]>([]);
  readonly vectorStores = signal<VectorStore[]>([]);
  readonly ingestions = signal<IngestionTracker[]>([]);
  protected selectedFile: File | null = null;

  readonly form = this.fb.group({
    s3_file_url: ['', Validators.pattern(/^https?:\/\//i)],
    vector_store_id: ['', Validators.required]
  });

  constructor() {
    effect(() => {
      if (!this.state.workspaceReady()) {
        this.documents.set([]);
        this.vectorStores.set([]);
        this.ingestions.set([]);
        return;
      }
      this.loadVectorStores();
      this.loadDocuments();
    });

    this.form
      .get('s3_file_url')
      ?.valueChanges.pipe(takeUntilDestroyed())
      .subscribe(value => {
        this.toggleChatLock(Boolean(value) || Boolean(this.selectedFile));
      });

    effect(() => {
      const stores = this.vectorStores();
      const current = this.form.value.vector_store_id;
      if (!stores.length) {
        this.form.patchValue({ vector_store_id: '' }, { emitEvent: false });
        return;
      }
      if (!current || !stores.some(store => store.id === current)) {
        this.form.patchValue({ vector_store_id: stores[0].id }, { emitEvent: false });
      }
    });
  }

  handleFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.item(0) ?? null;
    this.toggleChatLock(Boolean(this.selectedFile) || Boolean(this.form.value.s3_file_url));
  }

  submit(): void {
    if (!this.state.workspaceReady()) {
      this.notifications.push('info', 'Workspace is still being prepared. Please try again in a moment.');
      return;
    }
    const vectorStoreId = this.form.value.vector_store_id;
    if (!vectorStoreId) {
      this.notifications.push('warning', 'Select a vector store before uploading.');
      return;
    }
    const hasFile = Boolean(this.selectedFile);
    const hasUrl = Boolean(this.form.value.s3_file_url);
    if ((hasFile && hasUrl) || (!hasFile && !hasUrl)) {
      this.notifications.push('warning', 'Provide either a file or an S3 URL (but not both).');
      return;
    }
    this.state.setUploading(true);
    this.documentService
      .ingest({
        vector_store_id: vectorStoreId,
        file: this.selectedFile ?? undefined,
        s3_file_url: this.form.value.s3_file_url ?? undefined
      })
      .subscribe({
        next: response => {
          this.pushIngestion(response.document_id, response.file_name, response.status);
          this.pollStatus(response.document_id);
          this.selectedFile = null;
          this.form.reset({ vector_store_id: vectorStoreId, s3_file_url: '' });
          this.toggleChatLock(false);
          this.loadDocuments();
          this.notifications.push('success', 'Document submitted for ingestion.');
        },
        error: error => {
          console.error('Document ingest failed', error);
          this.state.setUploading(false);
          this.toggleChatLock(false);
          this.notifications.push('error', 'Document upload failed. Please try again.');
        }
      });
  }

  remove(doc: DocumentItem): void {
    this.documentService.delete(doc.id).subscribe({
      next: () => {
        this.loadDocuments();
        this.notifications.push('success', 'Document removed.');
      },
      error: error => {
        console.error('Document removal failed', error);
        this.notifications.push('error', 'Unable to delete the document.');
      }
    });
  }

  resolveStoreName(id: string): string {
    const match = this.vectorStores().find(store => store.id === id);
    return match ? match.name : 'Unknown';
  }

  private loadDocuments(): void {
    this.documentService.list().subscribe({
      next: items => {
        this.documents.set(items);
      },
      error: error => {
        console.error('Failed to load documents', error);
        this.notifications.push('error', 'Unable to load documents.');
      }
    });
  }

  private pollStatus(id: string): void {
    interval(2000)
      .pipe(
        startWith(0),
        switchMap(() => this.documentService.status(id)),
        takeWhile(status => status.status !== 'completed', true),
        takeUntilDestroyed()
      )
      .subscribe({
        next: status => {
          this.ingestions.update(items =>
            items.map(item => (item.documentId === status.document_id ? { ...item, status: status.status } : item))
          );
          if (['completed', 'failed'].includes(status.status)) {
            this.state.setUploading(false);
            this.loadDocuments();
            if (status.status === 'failed') {
              this.notifications.push('error', 'Document ingestion failed.');
            }
            this.trimIngestion(status.document_id);
          }
        },
        error: error => {
          console.error('Document status polling failed', error);
          this.state.setUploading(false);
          this.trimIngestion(id);
        }
      });
  }

  private loadVectorStores(): void {
    this.vectorStoreService.list().subscribe({
      next: stores => this.vectorStores.set(stores),
      error: error => {
        console.error('Failed to load vector stores', error);
        this.notifications.push('error', 'Unable to load vector stores.');
      }
    });
  }

  private toggleChatLock(locked: boolean): void {
    this.state.setProjectChatLocked(locked);
  }

  private pushIngestion(documentId: string, fileName: string, status: DocumentStatus): void {
    this.ingestions.update(items => {
      const others = items.filter(item => item.documentId !== documentId);
      return [...others, { documentId, fileName, status }];
    });
  }

  private trimIngestion(documentId: string): void {
    this.ingestions.update(items => items.filter(item => item.documentId !== documentId));
    if (!this.ingestions().length) {
      this.toggleChatLock(false);
    }
  }
}
