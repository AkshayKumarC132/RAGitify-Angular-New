import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VectorStoreService } from '../services/vectorstore.service';
import { AssistantService } from '../services/assistant.service';
import { DocumentService } from '../services/document.service';
import { GlobalState } from '../state/global.state';
import { VectorStore } from '../models/vector-store.model';
import { Assistant } from '../models/assistant.model';
import { DocumentItem } from '../models/document.model';
import { DocumentAccessService } from '../services/document-access.service';
import { NotificationService } from '../services/notification.service';
import { DocumentAccess } from '../models/document-access.model';
import { ThreadService } from '../services/thread.service';
import { combineLatest, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, ReactiveFormsModule],
  template: `
    <div class="flex h-full flex-col gap-6 px-6 py-6">
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="text-lg font-semibold">Projects</h2>
            <p class="text-sm text-slate-400">Workspaces linking vector stores, assistants, and documents.</p>
          </div>
          <form [formGroup]="projectForm" (ngSubmit)="openCreate()" class="grid gap-3 md:grid-cols-[200px_1fr_160px]">
            <input formControlName="name" placeholder="Project name" class="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm" />
            <textarea formControlName="instructions" placeholder="Assistant instructions" class="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm md:col-span-1"></textarea>
            <select formControlName="model" class="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm">
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
            <button class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40" type="submit" [disabled]="projectForm.invalid">
              Create project
            </button>
          </form>
        </div>
        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <article *ngFor="let project of projects()" class="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <header class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-semibold">{{ project.store.name }}</h3>
                <p class="text-xs text-slate-400">Assistant: {{ project.assistant.name }} · Model: {{ project.assistant.model }}</p>
              </div>
              <button class="rounded-lg border border-white/10 px-3 py-1 text-xs" (click)="setActive(project)">Open</button>
            </header>
            <section class="mt-4 text-sm text-slate-300">
              <h4 class="text-xs uppercase tracking-widest text-slate-500">Instructions</h4>
              <p class="mt-2 whitespace-pre-wrap">{{ project.assistant.instructions }}</p>
            </section>
          </article>
        </div>
      </section>
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 class="text-lg font-semibold">Library documents</h2>
        <p class="text-sm text-slate-400">Link documents to the active assistant to enable retrieval-augmented responses.</p>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <label *ngFor="let doc of documents()" class="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <input type="checkbox" [checked]="selectedDocuments().includes(doc.id)" (change)="toggleDoc(doc.id, $event.target.checked)" />
            <div>
              <p class="font-medium">{{ doc.title }}</p>
              <p class="text-xs text-slate-400">Status: {{ doc.status }}</p>
            </div>
          </label>
        </div>
      </section>
    </div>
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

  readonly projects = signal<{ store: VectorStore; assistant: Assistant }[]>([]);
  readonly documents = signal<DocumentItem[]>([]);
  readonly selectedDocuments = signal<string[]>([]);
  readonly documentLinks = signal<DocumentAccess[]>([]);

  readonly projectForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    instructions: ['', [Validators.required, Validators.minLength(10)]],
    model: ['gpt-4o-mini', Validators.required]
  });

  constructor() {
    effect(() => {
      if (!this.state.workspaceReady()) {
        this.projects.set([]);
        this.documents.set([]);
        this.selectedDocuments.set([]);
        return;
      }
      const subscription = combineLatest([this.vectorStoreService.list(), this.assistantService.list()]).subscribe({
        next: ([stores, assistants]) => {
          const mapped = stores
            .map(store => {
              const assistant = this.findAssistantForStore(assistants, store.id);
              return assistant ? { store, assistant } : null;
            })
            .filter((value): value is { store: VectorStore; assistant: Assistant } => value !== null);
          if (mapped.length) {
            this.projects.set(mapped);
          } else {
            const store = this.state.currentVectorStore();
            const assistant = this.state.currentAssistant();
            if (store && assistant && this.resolveAssistantStoreId(assistant) === store.id) {
              this.projects.set([{ store, assistant }]);
            } else {
              this.projects.set([]);
            }
          }
          if (mapped.length && !this.state.currentVectorStore()) {
            this.setActive(mapped[0]);
          }
        },
        error: error => {
          console.error('Failed to load projects', error);
          this.notifications.push('error', 'Unable to load existing projects.');
        }
      });
      this.loadDocuments(this.state.currentVectorStore()?.id ?? undefined);
      this.refreshDocumentLinks();
      return () => subscription.unsubscribe();
    });
  }

  openCreate(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }
    const value = this.projectForm.getRawValue();
    this.vectorStoreService
      .create({ name: value.name! })
      .pipe(
        switchMap(store =>
          this.assistantService
            .create({
              name: `${value.name} Assistant`,
              instructions: value.instructions!,
              model: value.model!,
              vector_store_id: store.id
            })
            .pipe(switchMap(assistant => of({ store, assistant })))
        )
      )
      .subscribe({
        next: project => {
          this.notifications.push('success', 'Project created.');
          this.projects.update(list => [...list, project]);
          this.projectForm.reset({ name: '', instructions: '', model: 'gpt-4o-mini' });
          this.setActive(project);
        },
        error: error => {
          console.error('Project creation failed', error);
          this.notifications.push('error', 'Unable to create the project.');
        }
      });
  }

  setActive(project: { store: VectorStore; assistant: Assistant }): void {
    this.state.setProjectId(project.store.id);
    this.state.updateVectorStore(project.store);
    this.state.updateAssistant(project.assistant);
    this.state.updateThread(null);
    this.state.setMessages([]);
    this.loadDocuments(project.store.id);
    this.refreshDocumentLinks();
    this.selectedDocuments.set([]);
    this.ensureThread(project.store.id);
  }

  toggleDoc(id: string, checked: boolean): void {
    const store = this.state.currentVectorStore();
    if (!store) {
      return;
    }
    if (checked) {
      this.documentAccessService.create({ vector_store_id: store.id, document_ids: [id] }).subscribe({
        next: () => {
          this.selectedDocuments.update(list => [...new Set([...list, id])]);
          this.refreshDocumentLinks();
          this.notifications.push('success', 'Document linked to the assistant.');
        },
        error: error => {
          console.error('Linking document failed', error);
          this.notifications.push('error', 'Unable to link the document.');
        }
      });
    } else {
      this.documentAccessService.remove({ vector_store_id: store.id, document_ids: [id] }).subscribe({
        next: () => {
          this.selectedDocuments.update(list => list.filter(item => item !== id));
          this.refreshDocumentLinks();
          this.notifications.push('success', 'Document unlinked.');
        },
        error: error => {
          console.error('Unlinking document failed', error);
          this.notifications.push('error', 'Unable to unlink the document.');
        }
      });
    }
  }

  private loadDocuments(vectorStoreId?: string): void {
    this.documentService.list(vectorStoreId).subscribe({
      next: items => this.documents.set(items),
      error: error => {
        console.error('Failed to load documents', error);
        this.notifications.push('error', 'Unable to load documents for linking.');
      }
    });
  }

  private refreshDocumentLinks(): void {
    this.documentAccessService.list().subscribe({
      next: links => {
        this.documentLinks.set(links);
        const store = this.state.currentVectorStore();
        if (store) {
          this.selectedDocuments.set(links.filter(link => link.vector_store === store.id).map(link => link.document));
        }
      },
      error: error => {
        console.error('Failed to load document links', error);
        this.notifications.push('error', 'Unable to load linked documents.');
      }
    });
  }

  private ensureThread(storeId: string): void {
    this.threadService
      .list(storeId)
      .pipe(
        switchMap(threads => {
          if (threads.length) {
            return of(threads[0]);
          }
          return this.threadService.create({ vector_store_id: storeId, title: 'New conversation' });
        })
      )
      .subscribe({
        next: thread => this.state.updateThread(thread),
        error: error => {
          console.error('Failed to prepare thread for project', error);
          this.notifications.push('error', 'Unable to prepare a chat thread for this project.');
        }
      });
  }

  private findAssistantForStore(assistants: Assistant[], storeId: string): Assistant | null {
    const assistant = assistants.find(item => this.resolveAssistantStoreId(item) === storeId);
    if (assistant) {
      return assistant;
    }
    const activeAssistant = this.state.currentAssistant();
    if (activeAssistant && this.resolveAssistantStoreId(activeAssistant) === storeId) {
      return activeAssistant;
    }
    return null;
  }

  private resolveAssistantStoreId(assistant: Assistant): string | null {
    return assistant.vector_store_id ?? assistant.vector_store_id_read ?? assistant.vector_store ?? null;
  }
}
