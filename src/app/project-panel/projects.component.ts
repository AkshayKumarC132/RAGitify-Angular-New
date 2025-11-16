import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, forkJoin, interval, of, startWith, switchMap, takeWhile } from 'rxjs';
import { VectorStoreService } from '../services/vectorstore.service';
import { AssistantService } from '../services/assistant.service';
import { DocumentService } from '../services/document.service';
import { GlobalState } from '../state/global.state';
import { VectorStore } from '../models/vector-store.model';
import { Assistant } from '../models/assistant.model';
import { DocumentItem, DocumentStatus } from '../models/document.model';
import { DocumentAccessService } from '../services/document-access.service';
import { NotificationService } from '../services/notification.service';
import { ThreadService } from '../services/thread.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface ProjectView {
  store: VectorStore;
  assistant: Assistant;
}

interface PendingProjectConfig {
  name: string;
  instructions: string;
  model: string;
}

interface PendingUpload {
  documentId: string;
  fileName: string;
  status: DocumentStatus;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, ReactiveFormsModule],
  template: `
    <div class="flex h-full flex-col gap-6 px-6 py-6">
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-lg font-semibold">Projects</h2>
            <p class="text-sm text-slate-400">Workspaces linking vector stores, assistants, and documents.</p>
          </div>
          <button class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" (click)="openStepOne()">
            New project
          </button>
        </header>
        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <article *ngFor="let project of projects()" class="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <header class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold">{{ project.store.name }}</h3>
                <p class="text-xs text-slate-400">Assistant: {{ project.assistant.name }} · Model: {{ project.assistant.model }}</p>
              </div>
              <div class="flex items-center gap-2">
                <button class="shrink-0 rounded-lg border border-white/10 px-3 py-1 text-xs" (click)="editProject(project)">
                  Edit
                </button>
                <button class="shrink-0 rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-200" (click)="deleteProject(project)">
                  Delete
                </button>
                <button class="shrink-0 rounded-lg border border-white/10 px-3 py-1 text-xs" (click)="setActive(project)">
                  Open
                </button>
              </div>
            </header>
            <section class="mt-4 text-sm text-slate-300">
              <h4 class="text-xs uppercase tracking-widest text-slate-500">Instructions</h4>
              <p class="mt-2 line-clamp-5 whitespace-pre-wrap">{{ project.assistant.instructions }}</p>
            </section>
          </article>
          <p *ngIf="projects().length === 0" class="col-span-full rounded-xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
            No projects yet. Create one to connect assistants, threads, and documents.
          </p>
        </div>
      </section>
    </div>

    <section *ngIf="showStepOne()" class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur">
      <div class="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
        <h3 class="text-lg font-semibold">Create a project</h3>
        <p class="mt-1 text-sm text-slate-400">Name your project and define the assistant instructions.</p>
        <form [formGroup]="stepOneForm" (ngSubmit)="completeStepOne()" class="mt-4 space-y-4">
          <div>
            <label class="text-xs uppercase tracking-widest text-slate-500">Project name</label>
            <input
              formControlName="name"
              placeholder="Project name"
              class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            />
            <p *ngIf="stepOneForm.controls.name.invalid && stepOneForm.controls.name.touched" class="mt-1 text-xs text-red-300">
              Provide a project name (min 3 characters).
            </p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-widest text-slate-500">Assistant instructions</label>
            <textarea
              formControlName="instructions"
              rows="5"
              placeholder="Assistant instructions"
              class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            ></textarea>
            <p
              *ngIf="stepOneForm.controls.instructions.invalid && stepOneForm.controls.instructions.touched"
              class="mt-1 text-xs text-red-300"
            >
              Provide instructions (min 10 characters).
            </p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-widest text-slate-500">Model</label>
            <select formControlName="model" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm">
              <option *ngFor="let option of models" [value]="option">{{ option }}</option>
            </select>
          </div>
          <footer class="flex justify-end gap-3 pt-2">
            <button type="button" class="rounded-lg border border-white/10 px-3 py-2 text-sm" (click)="closeWizard()">Cancel</button>
            <button
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              type="submit"
              [disabled]="stepOneForm.invalid"
            >
              Continue
            </button>
          </footer>
        </form>
      </div>
    </section>

    <section *ngIf="showStepTwo()" class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur">
      <div class="w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <header class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">Link documents</h3>
            <p class="text-sm text-slate-400">Select existing documents or upload new ones. Pick at least one to continue.</p>
          </div>
          <button class="rounded-lg border border-white/10 px-3 py-1 text-sm" (click)="backToStepOne()">Back</button>
        </header>
        <div class="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section>
            <h4 class="text-sm font-semibold text-slate-200">Library</h4>
            <p class="text-xs text-slate-500">Choose documents to include in this project.</p>
            <div class="mt-3 max-h-72 overflow-y-auto space-y-2 pr-2">
              <label
                *ngFor="let doc of availableDocuments()"
                class="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-primary"
              >
                <input
                  type="checkbox"
                  class="mt-1"
                  [checked]="selectedDocumentIds().has(doc.id)"
                  (change)="toggleDocument(doc, $event.target.checked)"
                />
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ doc.title }}</p>
                  <p class="text-xs text-slate-400">Status: {{ doc.status }} · Store: {{ resolveStoreName(doc.vector_store) }}</p>
                </div>
              </label>
              <p *ngIf="availableDocuments().length === 0" class="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No documents found. Upload files using the form on the right.
              </p>
            </div>
          </section>
          <section class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <h4 class="text-sm font-semibold text-slate-200">Upload</h4>
            <p class="text-xs text-slate-500">Add new documents to your library. They will be linked automatically.</p>
            <form [formGroup]="uploadForm" (ngSubmit)="uploadDocument()" class="mt-3 space-y-3">
              <div>
                <label class="text-xs uppercase tracking-widest text-slate-500">Vector store</label>
                <select formControlName="vector_store_id" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm">
                  <option value="" disabled>Select a vector store</option>
                  <option *ngFor="let store of vectorStores()" [value]="store.id">{{ store.name }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs uppercase tracking-widest text-slate-500">File</label>
                <input type="file" (change)="onUploadFile($event)" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm" />
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
                  (!uploadFile && !uploadForm.value.s3_file_url) ||
                  (uploadFile && uploadForm.value.s3_file_url) ||
                  creatingProject()
                "
              >
                Upload & link
              </button>
            </form>
            <div class="mt-4 space-y-2" *ngIf="pendingUploads().length">
              <article
                *ngFor="let item of pendingUploads()"
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
          <button type="button" class="rounded-lg border border-white/10 px-3 py-2 text-sm" (click)="closeWizard()">Cancel</button>
          <button
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            (click)="finalizeProject()"
            [disabled]="selectedDocumentIds().size === 0 || creatingProject() || pendingUploads().length > 0"
          >
            {{ creatingProject() ? 'Creating…' : 'Create project' }}
          </button>
        </footer>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsComponent {
  private readonly vectorStoreService = inject(VectorStoreService);
  private readonly assistantService = inject(AssistantService);
  private readonly documentService = inject(DocumentService);
  private readonly documentAccessService = inject(DocumentAccessService);
  private readonly notifications = inject(NotificationService);
  private readonly threadService = inject(ThreadService);
  private readonly state = inject(GlobalState);
  private readonly fb = inject(FormBuilder);

  readonly projects = signal<ProjectView[]>([]);
  readonly vectorStores = signal<VectorStore[]>([]);
  readonly documents = signal<DocumentItem[]>([]);
  readonly selectedDocumentIds = signal<Set<string>>(new Set());
  readonly pendingUploads = signal<PendingUpload[]>([]);
  readonly creatingProject = signal(false);
  readonly showStepOne = signal(false);
  readonly showStepTwo = signal(false);
  readonly models = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

  private pendingConfig: PendingProjectConfig | null = null;
  private uploadFile: File | null = null;

  readonly stepOneForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    instructions: ['', [Validators.required, Validators.minLength(10)]],
    model: ['gpt-4o-mini', Validators.required]
  });

  readonly uploadForm = this.fb.group({
    vector_store_id: ['', Validators.required],
    s3_file_url: ['', Validators.pattern(/^https?:\/\//i)]
  });

  constructor() {
    effect(() => {
      if (!this.state.workspaceReady()) {
        this.projects.set([]);
        this.vectorStores.set([]);
        this.documents.set([]);
        this.selectedDocumentIds.set(new Set());
        return;
      }
      this.bootstrapProjects();
      this.loadVectorStores();
      this.loadDocuments();
    });

    this.uploadForm
      .get('s3_file_url')
      ?.valueChanges.pipe(takeUntilDestroyed())
      .subscribe(value => this.state.setProjectChatLocked(Boolean(value) || Boolean(this.uploadFile)));
  }

  openStepOne(): void {
    this.stepOneForm.reset({ name: '', instructions: '', model: 'gpt-4o-mini' });
    this.pendingConfig = null;
    this.selectedDocumentIds.set(new Set());
    this.showStepOne.set(true);
    this.state.setProjectChatLocked(true);
  }

  completeStepOne(): void {
    if (this.stepOneForm.invalid) {
      this.stepOneForm.markAllAsTouched();
      return;
    }
    this.pendingConfig = this.stepOneForm.getRawValue() as PendingProjectConfig;
    this.showStepOne.set(false);
    this.showStepTwo.set(true);
    this.state.setProjectChatLocked(true);
  }

  backToStepOne(): void {
    this.showStepTwo.set(false);
    this.showStepOne.set(true);
  }

  closeWizard(): void {
    this.showStepOne.set(false);
    this.showStepTwo.set(false);
    this.pendingConfig = null;
    this.selectedDocumentIds.set(new Set());
    this.pendingUploads.set([]);
    this.uploadForm.reset({ vector_store_id: '', s3_file_url: '' });
    this.uploadFile = null;
    if (!this.state.uploading()) {
      this.state.setProjectChatLocked(false);
    }
  }

  availableDocuments(): DocumentItem[] {
    return this.documents();
  }

  toggleDocument(doc: DocumentItem, checked: boolean): void {
    const next = new Set(this.selectedDocumentIds());
    if (checked) {
      next.add(doc.id);
    } else {
      next.delete(doc.id);
    }
    this.selectedDocumentIds.set(next);
  }

  onUploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = input.files?.item(0) ?? null;
    this.state.setProjectChatLocked(Boolean(this.uploadFile) || Boolean(this.uploadForm.value.s3_file_url));
  }

  uploadDocument(): void {
    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }
    const hasFile = Boolean(this.uploadFile);
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
        file: this.uploadFile ?? undefined,
        s3_file_url: this.uploadForm.value.s3_file_url ?? undefined
      })
      .subscribe({
        next: response => {
          this.pendingUploads.update(items => [
            ...items.filter(item => item.documentId !== response.document_id),
            { documentId: response.document_id, fileName: response.file_name, status: response.status }
          ]);
          this.selectedDocumentIds.update(current => {
            const next = new Set(current);
            next.add(response.document_id);
            return next;
          });
          this.pollUploadStatus(response.document_id);
          this.uploadFile = null;
          this.uploadForm.reset({ vector_store_id: vectorStoreId, s3_file_url: '' });
          this.loadDocuments();
          this.notifications.push('success', 'Document submitted for ingestion.');
        },
        error: error => {
          console.error('Document ingest failed', error);
          this.state.setUploading(false);
          if (!this.showStepOne() && !this.showStepTwo()) {
            this.state.setProjectChatLocked(false);
          }
          this.notifications.push('error', 'Unable to upload the document.');
        }
      });
  }

  finalizeProject(): void {
    if (!this.pendingConfig) {
      return;
    }
    if (this.selectedDocumentIds().size === 0) {
      this.notifications.push('warning', 'Select at least one document.');
      return;
    }
    if (this.pendingUploads().length > 0) {
      this.notifications.push('info', 'Please wait for uploads to finish before creating the project.');
      return;
    }
    this.creatingProject.set(true);
    const config = this.pendingConfig;
    this.vectorStoreService
      .create({ name: config.name })
      .pipe(
        switchMap(store =>
          this.assistantService.create({
            name: `${config.name} Assistant`,
            instructions: config.instructions,
            model: config.model,
            vector_store_id: store.id
          }).pipe(
            switchMap(assistant => {
              const docIds = Array.from(this.selectedDocumentIds());
              if (docIds.length === 0) {
                return of({ store, assistant } as ProjectView);
              }
              return this.documentAccessService
                .create({ vector_store_id: store.id, document_ids: docIds })
                .pipe(switchMap(() => of({ store, assistant } as ProjectView)));
            })
          )
        )
      )
      .subscribe({
        next: project => {
          this.notifications.push('success', 'Project created successfully.');
          this.projects.update(items => [...items, project]);
          this.creatingProject.set(false);
          this.closeWizard();
          this.loadVectorStores();
          this.setActive(project);
        },
        error: error => {
          console.error('Project creation failed', error);
          this.creatingProject.set(false);
          this.state.setProjectChatLocked(false);
          this.notifications.push('error', 'Unable to create the project.');
        }
      });
  }

  setActive(project: ProjectView): void {
    this.state.setProjectId(project.store.id);
    this.state.updateVectorStore(project.store);
    this.state.updateAssistant(project.assistant);
    this.state.updateThread(null);
    this.state.setMessages([]);
    this.loadThreadsForStore(project.store.id);
  }

  editProject(project: ProjectView): void {
    const nameInput = window.prompt('Edit project name', project.store.name);
    if (nameInput === null) {
      return;
    }
    const instructionsInput = window.prompt('Edit assistant instructions', project.assistant.instructions ?? '');
    if (instructionsInput === null) {
      return;
    }
    const name = nameInput.trim();
    const instructions = instructionsInput.trim();
    if (!name || !instructions) {
      this.notifications.push('error', 'Project name and instructions are required.');
      return;
    }
    forkJoin({
      store: this.vectorStoreService.update(project.store.id, { name }),
      assistant: this.assistantService.update(project.assistant.id, { name: project.assistant.name, instructions })
    }).subscribe({
      next: ({ store, assistant }) => {
        const updated = { store, assistant };
        this.projects.update(items => items.map(item => (item.store.id === project.store.id ? updated : item)));
        this.notifications.push('success', 'Project updated.');
        if (this.state.currentVectorStore()?.id === project.store.id) {
          this.setActive(updated);
        }
      },
      error: error => {
        console.error('Failed to update project', error);
        this.notifications.push('error', 'Unable to update the project.');
      }
    });
  }

  deleteProject(project: ProjectView): void {
    if (!window.confirm('Delete this project and its resources?')) {
      return;
    }
    forkJoin([
      this.assistantService.delete(project.assistant.id),
      this.vectorStoreService.delete(project.store.id)
    ]).subscribe({
      next: () => {
        this.notifications.push('success', 'Project deleted.');
        this.projects.update(items => items.filter(item => item.store.id !== project.store.id));
        if (this.state.currentVectorStore()?.id === project.store.id) {
          this.state.updateVectorStore(null);
          this.state.updateAssistant(null);
          this.state.updateThread(null);
          this.state.setMessages([]);
        }
      },
      error: error => {
        console.error('Failed to delete project', error);
        this.notifications.push('error', 'Unable to delete the project.');
      }
    });
  }

  resolveStoreName(id: string): string {
    const match = this.vectorStores().find(store => store.id === id);
    return match ? match.name : 'Unknown';
  }

  private bootstrapProjects(): void {
    combineLatest([this.vectorStoreService.list(), this.assistantService.list()])
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: ([stores, assistants]) => {
        const mapped: ProjectView[] = stores
          .map(store => {
            const assistant = assistants.find(item => this.resolveAssistantStoreId(item) === store.id);
            return assistant ? { store, assistant } : null;
          })
          .filter((value): value is ProjectView => value !== null);
        if (mapped.length) {
          this.projects.set(mapped);
          const active = this.state.currentVectorStore();
          if (!active && mapped.length) {
            this.setActive(mapped[0]);
          }
        } else {
          this.projects.set([]);
        }
      },
      error: error => {
        console.error('Failed to load projects', error);
        this.notifications.push('error', 'Unable to load existing projects.');
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

  private loadDocuments(): void {
    this.documentService.list().subscribe({
      next: docs => this.documents.set(docs),
      error: error => {
        console.error('Failed to load documents', error);
        this.notifications.push('error', 'Unable to load documents.');
      }
    });
  }

  private loadThreadsForStore(storeId: string): void {
    this.threadService
      .list(storeId)
      .pipe(
        switchMap(threads => {
          if (threads.length) {
            return of(threads[0]);
          }
          return this.threadService.create({ vector_store_id: storeId });
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: thread => this.state.updateThread(thread),
        error: error => {
          console.error('Failed to prepare thread for project', error);
          this.notifications.push('error', 'Unable to prepare a chat thread for this project.');
        }
      });
  }

  private pollUploadStatus(id: string): void {
    interval(2000)
      .pipe(
        startWith(0),
        switchMap(() => this.documentService.status(id)),
        takeWhile(status => status.status !== 'completed', true),
        takeUntilDestroyed()
      )
      .subscribe({
        next: status => {
          this.pendingUploads.update(items =>
            items.map(item => (item.documentId === status.document_id ? { ...item, status: status.status } : item))
          );
          if (['completed', 'failed'].includes(status.status)) {
            this.state.setUploading(false);
            if (status.status === 'failed') {
              this.notifications.push('error', 'Document ingestion failed.');
            }
            this.pendingUploads.update(items => items.filter(item => item.documentId !== status.document_id));
            if (!this.pendingUploads().length && !this.showStepOne() && !this.showStepTwo()) {
              this.state.setProjectChatLocked(false);
            }
            this.loadDocuments();
          }
        },
        error: error => {
          console.error('Document status polling failed', error);
          this.state.setUploading(false);
          this.pendingUploads.update(items => items.filter(item => item.documentId !== id));
          if (!this.showStepOne() && !this.showStepTwo()) {
            this.state.setProjectChatLocked(false);
          }
        }
      });
  }

  private resolveAssistantStoreId(assistant: Assistant): string | null {
    return assistant.vector_store_id ?? assistant.vector_store_id_read ?? assistant.vector_store ?? null;
  }
}
