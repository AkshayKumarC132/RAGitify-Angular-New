import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GlobalState } from '../state/global.state';
import { AssistantService } from '../services/assistant.service';
import { DocumentService } from '../services/document.service';
import { DocumentItem, DocumentStatus } from '../models/document.model';
import { DocumentAccessService } from '../services/document-access.service';
import { NotificationService } from '../services/notification.service';
import { VectorStoreService } from '../services/vectorstore.service';
import { ThreadService } from '../services/thread.service';
import { VectorStore } from '../models/vector-store.model';
import { ThreadItem } from '../models/thread.model';
import { combineLatest, forkJoin, interval, of, startWith, switchMap, takeWhile } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface AttachUpload {
  documentId: string;
  fileName: string;
  status: DocumentStatus;
}

@Component({
  selector: 'app-project-panel',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, AsyncPipe, ReactiveFormsModule],
  template: `
    <aside class="flex h-screen w-[340px] flex-col border-l border-white/10 bg-slate-950/70 p-6">
      <header class="space-y-1">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-semibold">Project</h2>
            <p class="text-sm text-slate-400">Manage instructions, linked documents, and threads.</p>
          </div>
          <button
            class="flex items-center justify-center rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-200"
            (click)="deleteCurrentProject()"
            aria-label="Delete project"
          >
            <span class="material-icons text-sm">delete</span>
          </button>
        </div>
      </header>
      <section class="mt-4 space-y-4">
        <ng-container *ngIf="currentStore() as store">
          <div>
            <label class="text-xs uppercase tracking-widest text-slate-500">Project name</label>
            <input
              class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
              [formControl]="projectForm.controls.name"
              (blur)="persistStoreName()"
            />
          </div>
        </ng-container>
        <ng-container *ngIf="assistant() as assistant">
          <div>
            <label class="text-xs uppercase tracking-widest text-slate-500">Assistant name</label>
            <input
              class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
              [value]="assistant.name"
              (blur)="updateAssistantName($any($event.target).value)"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-widest text-slate-500">Instructions</label>
            <textarea
              class="mt-1 h-32 w-full resize-none rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
              [formControl]="projectForm.controls.instructions"
              (blur)="persistInstructions()"
            ></textarea>
          </div>
        </ng-container>
        <div>
          <div class="flex items-center justify-between">
            <h3 class="text-xs uppercase tracking-widest text-slate-500">Linked documents</h3>
            <button class="rounded-lg border border-white/10 px-3 py-1 text-xs" (click)="openAttach()">Attach file</button>
          </div>
          <ul class="mt-2 space-y-2 text-sm text-slate-300">
            <li *ngFor="let doc of linkedDocuments()" class="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
              <div class="min-w-0">
                <p class="truncate font-medium">{{ doc.title }}</p>
                <p class="text-xs text-slate-500">Status: {{ doc.status }}</p>
              </div>
              <button class="rounded border border-red-500/40 px-2 py-1 text-[11px] text-red-300" (click)="unlink(doc)">Remove</button>
            </li>
            <li *ngIf="linkedDocuments().length === 0" class="text-xs text-slate-500">No documents linked yet.</li>
          </ul>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <h3 class="text-xs uppercase tracking-widest text-slate-500">Threads</h3>
            <div class="flex items-center gap-2">
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-100 hover:bg-white/5"
                (click)="createThread()"
                aria-label="Create thread"
              >
                <span class="material-icons text-[18px]">add</span>
              </button>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-100 hover:bg-white/5 disabled:opacity-40"
                (click)="editSelectedThread()"
                [disabled]="!state.currentThread()"
                aria-label="Edit selected thread"
              >
                <span class="material-icons text-[18px]">edit</span>
              </button>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                (click)="deleteSelectedThread()"
                [disabled]="!state.currentThread()"
                aria-label="Delete selected thread"
              >
                <span class="material-icons text-[18px]">delete</span>
              </button>
            </div>
          </div>
          <ul class="mt-2 space-y-2 text-sm text-slate-300">
            <li
              *ngFor="let thread of threads()"
              (click)="selectThread(thread)"
              class="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition"
              [ngClass]="{
                'border-primary bg-white/10': state.currentThread()?.id === thread.id,
                'border-white/10': state.currentThread()?.id !== thread.id
              }"
            >
              <span class="truncate">{{ thread.title ?? 'Untitled thread' }}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-slate-200 hover:bg-white/5"
                  (click)="editThread(thread, $event)"
                  aria-label="Edit thread"
                >
                  <span class="material-icons text-[18px]">edit</span>
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
                  (click)="deleteThread(thread, $event)"
                  aria-label="Delete thread"
                >
                  <span class="material-icons text-[18px]">delete</span>
                </button>
              </div>
            </li>
            <li *ngIf="threads().length === 0" class="text-xs text-slate-500">No threads yet.</li>
          </ul>
        </div>
      </section>
    </aside>

    <section *ngIf="showAttach()" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div class="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <header class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">Attach documents</h3>
            <p class="text-sm text-slate-400">Select library documents or upload new ones.</p>
          </div>
          <button class="rounded-lg border border-white/10 px-3 py-1 text-sm" (click)="closeAttach()">Close</button>
        </header>
        <div class="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section>
            <h4 class="text-sm font-semibold text-slate-200">Library</h4>
            <div class="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
              <label
                *ngFor="let doc of attachableDocuments()"
                class="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-primary"
              >
                <input
                  type="checkbox"
                  class="mt-1"
                  [checked]="attachSelection().has(doc.id)"
                  (change)="toggleAttach(doc, $event.target.checked)"
                />
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ doc.title }}</p>
                  <p class="text-xs text-slate-400">Status: {{ doc.status }} · Store: {{ resolveStoreName(doc.vector_store) }}</p>
                </div>
              </label>
              <p *ngIf="attachableDocuments().length === 0" class="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No documents available. Upload one using the form on the right.
              </p>
            </div>
          </section>
          <section class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <h4 class="text-sm font-semibold text-slate-200">Upload</h4>
            <form [formGroup]="uploadForm" (ngSubmit)="uploadForAttach()" class="mt-3 space-y-3">
              <div>
                <label class="text-xs uppercase tracking-widest text-slate-500">Vector store</label>
                <select formControlName="vector_store_id" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm">
                  <option value="" disabled>Select a vector store</option>
                  <option *ngFor="let store of vectorStores()" [value]="store.id">{{ store.name }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs uppercase tracking-widest text-slate-500">File</label>
                <input type="file" (change)="onAttachFile($event)" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm" />
              </div>
              <div>
                <label class="text-xs uppercase tracking-widest text-slate-500">S3 URL</label>
                <input
                  formControlName="s3_file_url"
                  type="url"
                  placeholder="https://..."
                  class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
                />
              </div>
              <button
                class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                type="submit"
                [disabled]="
                  uploadForm.invalid ||
                  (!attachFile && !uploadForm.value.s3_file_url) ||
                  (attachFile && uploadForm.value.s3_file_url)
                "
              >
                Upload & select
              </button>
            </form>
            <div class="mt-4 space-y-2" *ngIf="attachUploads().length">
              <article
                *ngFor="let item of attachUploads()"
                class="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
              >
                <div>
                  <p class="font-medium">{{ item.fileName }}</p>
                  <p class="uppercase tracking-widest">{{ item.status | titlecase }}</p>
                </div>
                <span class="relative flex h-2 w-2">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75"></span>
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
                </span>
              </article>
            </div>
          </section>
        </div>
        <footer class="mt-6 flex justify-end gap-3">
          <button class="rounded-lg border border-white/10 px-3 py-2 text-sm" (click)="closeAttach()">Cancel</button>
          <button
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            (click)="applyAttach()"
            [disabled]="attachSelection().size === 0 || attachUploads().length > 0"
          >
            Link documents
          </button>
        </footer>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectPanelComponent {
  readonly state = inject(GlobalState);
  private readonly assistantService = inject(AssistantService);
  private readonly documentService = inject(DocumentService);
  private readonly documentAccessService = inject(DocumentAccessService);
  private readonly notifications = inject(NotificationService);
  private readonly vectorStoreService = inject(VectorStoreService);
  private readonly threadService = inject(ThreadService);
  private readonly fb = inject(FormBuilder);

  readonly assistant = this.state.currentAssistant;
  readonly currentStore = this.state.currentVectorStore;
  readonly threads = signal<ThreadItem[]>([]);
  readonly linkedDocuments = signal<DocumentItem[]>([]);
  readonly vectorStores = signal<VectorStore[]>([]);
  readonly attachableDocuments = signal<DocumentItem[]>([]);
  readonly attachSelection = signal<Set<string>>(new Set());
  readonly attachUploads = signal<AttachUpload[]>([]);
  readonly showAttach = signal(false);

  readonly projectForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    instructions: ['', [Validators.required, Validators.minLength(10)]]
  });

  readonly uploadForm = this.fb.group({
    vector_store_id: ['', Validators.required],
    s3_file_url: ['', Validators.pattern(/^https?:\/\//i)]
  });

  private attachFile: File | null = null;

  constructor() {
    effect(() => {
      const store = this.state.currentVectorStore();
      const assistant = this.state.currentAssistant();
      if (!store || !assistant) {
        this.linkedDocuments.set([]);
        this.attachableDocuments.set([]);
        this.threads.set([]);
        this.projectForm.reset({ name: '', instructions: '' });
        return;
      }
      this.projectForm.patchValue({ name: store.name, instructions: assistant.instructions ?? '' }, { emitEvent: false });
      this.loadLinkedDocuments(store.id);
      this.loadAttachableDocuments();
      this.loadVectorStores();
      this.loadThreads(store.id);
    });

    this.uploadForm
      .get('s3_file_url')
      ?.valueChanges.pipe(takeUntilDestroyed())
      .subscribe(value => this.state.setProjectChatLocked(this.showAttach() || Boolean(value) || Boolean(this.attachFile)));
  }

  persistStoreName(): void {
    const store = this.state.currentVectorStore();
    const name = this.projectForm.value.name?.trim();
    if (!store || !name || name === store.name) {
      return;
    }
    this.vectorStoreService.update(store.id, { name }).subscribe({
      next: updated => {
        this.notifications.push('success', 'Project name updated.');
        this.state.updateVectorStore(updated);
        this.projectForm.patchValue({ name: updated.name }, { emitEvent: false });
      },
      error: error => {
        console.error('Failed to update project name', error);
        this.notifications.push('error', 'Unable to update project name.');
        this.projectForm.patchValue({ name: store.name }, { emitEvent: false });
      }
    });
  }

  persistInstructions(): void {
    const assistant = this.state.currentAssistant();
    const instructions = this.projectForm.value.instructions ?? '';
    if (!assistant || instructions === assistant.instructions) {
      return;
    }
    this.assistantService.update(assistant.id, { instructions }).subscribe({
      next: updated => {
        this.notifications.push('success', 'Assistant instructions updated.');
        this.state.updateAssistant(updated);
        this.projectForm.patchValue({ instructions: updated.instructions ?? '' }, { emitEvent: false });
      },
      error: error => {
        console.error('Failed to update instructions', error);
        this.notifications.push('error', 'Unable to update assistant instructions.');
        this.projectForm.patchValue({ instructions: assistant.instructions ?? '' }, { emitEvent: false });
      }
    });
  }

  updateAssistantName(value: string): void {
    const assistant = this.state.currentAssistant();
    const trimmed = value.trim();
    if (!assistant || !trimmed || trimmed === assistant.name) {
      return;
    }
    this.assistantService.update(assistant.id, { name: trimmed }).subscribe({
      next: updated => {
        this.notifications.push('success', 'Assistant name updated.');
        this.state.updateAssistant(updated);
      },
      error: error => {
        console.error('Failed to update assistant name', error);
        this.notifications.push('error', 'Unable to update assistant name.');
      }
    });
  }

  unlink(doc: DocumentItem): void {
    const store = this.state.currentVectorStore();
    if (!store) {
      return;
    }
    this.documentAccessService.remove({ vector_store_id: store.id, document_ids: [doc.id] }).subscribe({
      next: () => {
        this.notifications.push('success', 'Document unlinked.');
        this.loadLinkedDocuments(store.id);
      },
      error: error => {
        console.error('Failed to unlink document', error);
        this.notifications.push('error', 'Unable to unlink the document.');
      }
    });
  }

  createThread(): void {
    const store = this.state.currentVectorStore();
    if (!store) {
      return;
    }
    this.threadService.create({ vector_store_id: store.id }).subscribe({
      next: thread => {
        this.notifications.push('success', 'Thread created.');
        this.threads.update(list => [thread, ...list]);
        this.state.updateThread(thread);
      },
      error: error => {
        console.error('Failed to create thread', error);
        this.notifications.push('error', 'Unable to create a new thread.');
      }
    });
  }

  editThread(thread: ThreadItem, event?: Event): void {
    event?.stopPropagation();
    const proposed = window.prompt('Rename thread', thread.title ?? '');
    if (proposed === null) {
      return;
    }
    const title = proposed.trim();
    if (!title) {
      this.notifications.push('error', 'Thread name cannot be empty.');
      return;
    }
    this.threadService.update(thread.id, { title }).subscribe({
      next: updated => {
        this.notifications.push('success', 'Thread renamed.');
        this.threads.update(list => list.map(item => (item.id === thread.id ? updated : item)));
        if (this.state.currentThread()?.id === thread.id) {
          this.state.updateThread(updated);
        }
      },
      error: error => {
        console.error('Failed to rename thread', error);
        this.notifications.push('error', 'Unable to rename thread.');
      }
    });
  }

  deleteThread(thread: ThreadItem, event?: Event): void {
    event?.stopPropagation();
    if (!window.confirm('Delete this thread? This action cannot be undone.')) {
      return;
    }
    this.threadService.delete(thread.id).subscribe({
      next: () => {
        this.notifications.push('success', 'Thread deleted.');
        this.threads.update(list => list.filter(item => item.id !== thread.id));
        if (this.state.currentThread()?.id === thread.id) {
          this.state.updateThread(this.threads()[0] ?? null);
        }
      },
      error: error => {
        console.error('Failed to delete thread', error);
        this.notifications.push('error', 'Unable to delete thread.');
      }
    });
  }

  selectThread(thread: ThreadItem): void {
    this.state.updateThread(thread);
  }

  editSelectedThread(): void {
    const current = this.state.currentThread();
    if (current) {
      this.editThread(current);
    }
  }

  deleteSelectedThread(): void {
    const current = this.state.currentThread();
    if (current) {
      this.deleteThread(current);
    }
  }

  deleteCurrentProject(): void {
    const store = this.state.currentVectorStore();
    const assistant = this.state.currentAssistant();
    if (!store || !assistant) {
      this.notifications.push('error', 'No active project selected.');
      return;
    }
    if (!window.confirm('Delete this project and all its threads?')) {
      return;
    }
    forkJoin([
      this.assistantService.delete(assistant.id),
      this.vectorStoreService.delete(store.id)
    ]).subscribe({
      next: () => {
        this.notifications.push('success', 'Project removed.');
        this.state.updateVectorStore(null);
        this.state.updateAssistant(null);
        this.state.updateThread(null);
        this.state.setMessages([]);
        this.state.setProjectPanelOpen(false);
        this.threads.set([]);
        this.linkedDocuments.set([]);
        this.projectForm.reset({ name: '', instructions: '' });
      },
      error: error => {
        console.error('Failed to delete project', error);
        this.notifications.push('error', 'Unable to delete the project.');
      }
    });
  }

  openAttach(): void {
    this.showAttach.set(true);
    this.state.setProjectChatLocked(true);
    this.attachSelection.set(new Set(this.linkedDocuments().map(doc => doc.id)));
    this.attachUploads.set([]);
    this.attachFile = null;
    this.loadAttachableDocuments();
  }

  closeAttach(): void {
    this.showAttach.set(false);
    if (!this.state.uploading()) {
      this.state.setProjectChatLocked(false);
    }
    this.attachSelection.set(new Set());
    this.attachUploads.set([]);
    this.attachFile = null;
    this.uploadForm.reset({ vector_store_id: '', s3_file_url: '' });
  }

  toggleAttach(doc: DocumentItem, checked: boolean): void {
    const next = new Set(this.attachSelection());
    if (checked) {
      next.add(doc.id);
    } else {
      next.delete(doc.id);
    }
    this.attachSelection.set(next);
  }

  onAttachFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.attachFile = input.files?.item(0) ?? null;
    this.state.setProjectChatLocked(this.showAttach() || Boolean(this.attachFile) || Boolean(this.uploadForm.value.s3_file_url));
  }

  uploadForAttach(): void {
    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }
    const hasFile = Boolean(this.attachFile);
    const hasUrl = Boolean(this.uploadForm.value.s3_file_url);
    if ((hasFile && hasUrl) || (!hasFile && !hasUrl)) {
      this.notifications.push('warning', 'Provide either a file or an S3 URL (but not both).');
      return;
    }
    const vectorStoreId = this.uploadForm.value.vector_store_id!;
    this.state.setUploading(true);
    this.documentService
      .ingest({
        vector_store_id: vectorStoreId,
        file: this.attachFile ?? undefined,
        s3_file_url: this.uploadForm.value.s3_file_url ?? undefined
      })
      .subscribe({
        next: response => {
          this.attachUploads.update(items => [
            ...items.filter(item => item.documentId !== response.document_id),
            { documentId: response.document_id, fileName: response.file_name, status: response.status }
          ]);
          this.attachSelection.update(current => {
            const next = new Set(current);
            next.add(response.document_id);
            return next;
          });
          this.pollAttachStatus(response.document_id);
          this.attachFile = null;
          this.uploadForm.reset({ vector_store_id: vectorStoreId, s3_file_url: '' });
          this.loadAttachableDocuments();
          this.notifications.push('success', 'Document submitted for ingestion.');
        },
        error: error => {
          console.error('Failed to upload document', error);
          this.state.setUploading(false);
          this.notifications.push('error', 'Unable to upload the document.');
        }
      });
  }

  applyAttach(): void {
    const store = this.state.currentVectorStore();
    if (!store) {
      return;
    }
    const documentIds = Array.from(this.attachSelection());
    if (!documentIds.length) {
      this.notifications.push('warning', 'Select at least one document to link.');
      return;
    }
    this.documentAccessService.create({ vector_store_id: store.id, document_ids: documentIds }).subscribe({
      next: () => {
        this.notifications.push('success', 'Documents linked successfully.');
        this.loadLinkedDocuments(store.id);
        this.closeAttach();
      },
      error: error => {
        console.error('Failed to link documents', error);
        this.notifications.push('error', 'Unable to link the selected documents.');
      }
    });
  }

  resolveStoreName(id: string): string {
    const match = this.vectorStores().find(store => store.id === id);
    return match ? match.name : 'Unknown';
  }

  private loadLinkedDocuments(storeId: string): void {
    combineLatest([this.documentService.list(storeId), this.documentAccessService.list()])
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ([docs, links]) => {
          const linkedIds = new Set(links.filter(link => link.vector_store === storeId).map(link => link.document));
          this.linkedDocuments.set(docs.filter(doc => linkedIds.has(doc.id)));
        },
        error: error => {
          console.error('Failed to load linked documents', error);
          this.notifications.push('error', 'Unable to load linked documents.');
        }
      });
  }

  private loadAttachableDocuments(): void {
    this.documentService.list().subscribe({
      next: docs => this.attachableDocuments.set(docs),
      error: error => {
        console.error('Failed to load documents', error);
        this.notifications.push('error', 'Unable to load documents.');
      }
    });
  }

  private loadVectorStores(): void {
    this.vectorStoreService.list().subscribe({
      next: stores => {
        this.vectorStores.set(stores);
        if (!this.uploadForm.value.vector_store_id && stores.length) {
          this.uploadForm.patchValue({ vector_store_id: stores[0].id }, { emitEvent: false });
        }
      },
      error: error => {
        console.error('Failed to load vector stores', error);
        this.notifications.push('error', 'Unable to load vector stores.');
      }
    });
  }

  private loadThreads(storeId: string): void {
    this.threadService.list(storeId).subscribe({
      next: items => this.threads.set(items),
      error: error => {
        console.error('Failed to load threads', error);
        this.notifications.push('error', 'Unable to load project threads.');
      }
    });
  }

  private pollAttachStatus(id: string): void {
    interval(2000)
      .pipe(
        startWith(0),
        switchMap(() => this.documentService.status(id)),
        takeWhile(status => status.status !== 'completed', true),
        takeUntilDestroyed()
      )
      .subscribe({
        next: status => {
          this.attachUploads.update(items =>
            items.map(item => (item.documentId === status.document_id ? { ...item, status: status.status } : item))
          );
          if (['completed', 'failed'].includes(status.status)) {
            this.state.setUploading(false);
            if (status.status === 'failed') {
              this.notifications.push('error', 'Document ingestion failed.');
            }
            this.attachUploads.update(items => items.filter(item => item.documentId !== status.document_id));
            this.loadAttachableDocuments();
          }
        },
        error: error => {
          console.error('Document status polling failed', error);
          this.state.setUploading(false);
          this.attachUploads.update(items => items.filter(item => item.documentId !== id));
        }
      });
  }
}
