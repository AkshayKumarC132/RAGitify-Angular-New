import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval, startWith, switchMap, takeWhile, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocumentService } from '../services/document.service';
import { DocumentItem } from '../models/document.model';
import { GlobalState } from '../state/global.state';
import { UploadProgressComponent } from './upload-progress.component';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, DatePipe, ReactiveFormsModule, UploadProgressComponent],
  template: `
    <div class="flex h-full flex-col gap-6 px-6 py-6">
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 class="text-lg font-semibold">Upload documents</h2>
        <p class="text-sm text-slate-400">Upload files or provide an S3 URL to ingest into the current vector store.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm text-slate-300">File</label>
            <input type="file" (change)="handleFile($event)" class="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm" />
          </div>
          <div class="space-y-2">
            <label class="text-sm text-slate-300">S3 URL</label>
            <input formControlName="s3_file_url" type="url" placeholder="https://..." class="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm" />
          </div>
          <div class="md:col-span-2 flex justify-end">
            <button
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              type="submit"
              [disabled]="state.uploading() || (!selectedFile && !form.value.s3_file_url)"
            >
              Ingest document
            </button>
          </div>
        </form>
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
                <th class="px-4 py-2 font-medium">Status</th>
                <th class="px-4 py-2 font-medium">Uploaded</th>
                <th class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documents()" class="border-b border-white/5">
                <td class="px-4 py-3">{{ doc.title }}</td>
                <td class="px-4 py-3 capitalize" [class.text-emerald-400]="doc.status === 'completed'">{{ doc.status }}</td>
                <td class="px-4 py-3">{{ doc.uploaded_at | date: 'short' }}</td>
                <td class="px-4 py-3 text-right">
                  <button class="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10" (click)="remove(doc)">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p *ngIf="documents().length === 0" class="py-10 text-center text-sm text-slate-400">No documents yet.</p>
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

  readonly documents = signal<DocumentItem[]>([]);
  protected selectedFile: File | null = null;

  readonly form = this.fb.group({
    s3_file_url: ['', Validators.pattern(/^https?:\/\//i)]
  });

  constructor() {
    effect(() => {
      const store = this.state.currentVectorStore();
      this.loadDocuments(store?.id);
    });
  }

  handleFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.item(0) ?? null;
  }

  submit(): void {
    const vectorStore = this.state.currentVectorStore();
    if (!vectorStore) {
      this.notifications.push('warning', 'Create a project with a vector store before uploading.');
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
      .ingest({ vector_store_id: vectorStore.id, file: this.selectedFile ?? undefined, s3_file_url: this.form.value.s3_file_url ?? undefined })
      .subscribe({
        next: response => {
          this.pollStatus(response.document_id);
          this.selectedFile = null;
          this.form.reset();
          this.loadDocuments(vectorStore.id);
          this.notifications.push('success', 'Document submitted for ingestion.');
        },
        error: error => {
          console.error('Document ingest failed', error);
          this.state.setUploading(false);
          this.notifications.push('error', 'Document upload failed. Please try again.');
        }
      });
  }

  remove(doc: DocumentItem): void {
    this.documentService.delete(doc.id).subscribe({
      next: () => {
        const store = this.state.currentVectorStore();
        this.loadDocuments(store?.id);
        this.notifications.push('success', 'Document removed.');
      },
      error: error => {
        console.error('Document removal failed', error);
        this.notifications.push('error', 'Unable to delete the document.');
      }
    });
  }

  private loadDocuments(vectorStoreId?: string | null): void {
    this.documentService.list(vectorStoreId ?? undefined).subscribe({
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
            if (['completed', 'failed'].includes(status.status)) {
              this.state.setUploading(false);
              const store = this.state.currentVectorStore();
              this.loadDocuments(store?.id);
              if (status.status === 'failed') {
                this.notifications.push('error', 'Document ingestion failed.');
              }
            }
        },
        error: error => {
          console.error('Document status polling failed', error);
          this.state.setUploading(false);
        }
      });
  }
}
