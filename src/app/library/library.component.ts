import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
            <input formControlName="s3_url" type="url" placeholder="https://..." class="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm" />
          </div>
          <div class="md:col-span-2 flex justify-end">
            <button
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              type="submit"
              [disabled]="state.uploading() || (!selectedFile && !form.value.s3_url)"
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
                <th class="px-4 py-2 font-medium">Name</th>
                <th class="px-4 py-2 font-medium">Status</th>
                <th class="px-4 py-2 font-medium">Size</th>
                <th class="px-4 py-2 font-medium">Updated</th>
                <th class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documents()" class="border-b border-white/5">
                <td class="px-4 py-3">{{ doc.name }}</td>
                <td class="px-4 py-3 capitalize" [class.text-emerald-400]="doc.status === 'completed'">{{ doc.status }}</td>
                <td class="px-4 py-3">{{ doc.size_bytes / 1024 | number:'1.0-0' }} KB</td>
                <td class="px-4 py-3">{{ doc.updated_at | date: 'short' }}</td>
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
    s3_url: ['', Validators.pattern(/^https?:\/\//i)]
  });

  constructor() {
    this.loadDocuments();
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
    if (!this.selectedFile && !this.form.value.s3_url) {
      return;
    }
    this.state.setUploading(true);
    this.documentService
      .ingest({ vector_store_id: vectorStore.id, document: this.selectedFile ?? undefined, s3_url: this.form.value.s3_url ?? undefined })
      .subscribe(doc => {
        this.pollStatus(doc.id);
        this.selectedFile = null;
        this.form.reset();
        this.loadDocuments();
      });
  }

  remove(doc: DocumentItem): void {
    this.documentService.delete(doc.id).subscribe(() => {
      this.loadDocuments();
    });
  }

  private loadDocuments(): void {
    this.documentService.list().subscribe(items => {
      this.documents.set(items);
    });
  }

  private pollStatus(id: string): void {
    interval(2000)
      .pipe(
        startWith(0),
        switchMap(() => this.documentService.status(id)),
        tap(status => {
          if (status.status === 'failed') {
            this.notifications.push('error', status.error_message ?? 'Ingestion failed');
          }
        }),
        takeWhile(status => status.status !== 'completed', true),
        takeUntilDestroyed()
      )
      .subscribe(status => {
        if (['completed', 'failed'].includes(status.status)) {
          this.state.setUploading(false);
          this.loadDocuments();
        }
      });
  }
}
