import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
              <p class="font-medium">{{ doc.name }}</p>
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
    this.load();
  }

  openCreate(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }
    const value = this.projectForm.getRawValue();
    this.vectorStoreService
      .create({ name: value.name!, description: 'Project vector store' })
      .pipe(
        switchMap(store =>
          this.assistantService
            .create({
              name: `${value.name} Assistant`,
              instructions: value.instructions!,
              model: value.model!,
              vector_store: store.id
            })
            .pipe(switchMap(assistant => of({ store, assistant })))
        )
      )
      .subscribe(project => {
        this.notifications.push('success', 'Project created.');
        this.projects.update(list => [...list, project]);
        this.projectForm.reset({ name: '', instructions: '', model: 'gpt-4o-mini' });
        this.setActive(project);
      });
  }

  setActive(project: { store: VectorStore; assistant: Assistant }): void {
    this.state.updateVectorStore(project.store);
    this.state.updateAssistant(project.assistant);
    this.state.updateThread(null);
    this.loadDocuments();
    this.refreshDocumentLinks();
    this.selectedDocuments.set([]);
  }

  toggleDoc(id: string, checked: boolean): void {
    const assistant = this.state.currentAssistant();
    if (!assistant) {
      return;
    }
    if (checked) {
      this.documentAccessService.create({ assistant_id: assistant.id, document_ids: [id] }).subscribe(() => {
        this.selectedDocuments.update(list => [...new Set([...list, id])]);
        this.refreshDocumentLinks();
      });
    } else {
      const link = this.documentLinks().find(item => item.document === id && item.assistant === assistant.id);
      if (!link) {
        return;
      }
      this.documentAccessService.delete(link.id).subscribe(() => {
        this.selectedDocuments.update(list => list.filter(item => item !== id));
        this.refreshDocumentLinks();
      });
    }
  }

  private load(): void {
    combineLatest([this.vectorStoreService.list(), this.assistantService.list()]).subscribe(([stores, assistants]) => {
      const mapped = stores
        .map(store => {
          const assistant = assistants.find(item => item.vector_store === store.id);
          return assistant ? { store, assistant } : null;
        })
        .filter((value): value is { store: VectorStore; assistant: Assistant } => value !== null);
      this.projects.set(mapped);
      if (mapped.length && !this.state.currentVectorStore()) {
        this.setActive(mapped[0]);
      }
    });
    this.loadDocuments();
    this.refreshDocumentLinks();
  }

  private loadDocuments(): void {
    this.documentService.list().subscribe(items => this.documents.set(items));
  }

  private refreshDocumentLinks(): void {
    this.documentAccessService.list().subscribe(links => {
      this.documentLinks.set(links);
      const assistant = this.state.currentAssistant();
      if (assistant) {
        this.selectedDocuments.set(links.filter(link => link.assistant === assistant.id).map(link => link.document));
      }
    });
  }
}
