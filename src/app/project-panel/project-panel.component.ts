import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { GlobalState } from '../state/global.state';
import { AssistantService } from '../services/assistant.service';
import { DocumentService } from '../services/document.service';
import { DocumentItem } from '../models/document.model';
import { DocumentAccessService } from '../services/document-access.service';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-project-panel',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, ReactiveFormsModule],
  template: `
    <aside class="flex h-screen w-[320px] flex-col border-l border-white/10 bg-slate-950/60 p-6">
      <header>
        <h2 class="text-base font-semibold">Project</h2>
        <p class="text-sm text-slate-400">Manage instructions and linked documents.</p>
      </header>
      <section class="mt-4 space-y-4">
        <div *ngIf="assistant() as assistant">
          <label class="text-xs uppercase tracking-widest text-slate-500">Assistant name</label>
          <input
            class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            [value]="assistant.name"
            (change)="updateAssistant({ name: $any($event.target).value })"
          />
          <label class="mt-3 text-xs uppercase tracking-widest text-slate-500">Instructions</label>
          <textarea
            class="mt-1 h-32 w-full resize-none rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            [value]="assistant.instructions"
            (change)="updateAssistant({ instructions: $any($event.target).value })"
          ></textarea>
        </div>
        <div>
          <h3 class="text-xs uppercase tracking-widest text-slate-500">Linked documents</h3>
          <ul class="mt-2 space-y-2 text-sm text-slate-300">
            <li *ngFor="let doc of documents()" class="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
              {{ doc.title }}
            </li>
            <li *ngIf="documents().length === 0" class="text-xs text-slate-500">No documents linked yet.</li>
          </ul>
        </div>
      </section>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectPanelComponent {
  private readonly state = inject(GlobalState);
  private readonly assistantService = inject(AssistantService);
  private readonly documentService = inject(DocumentService);
  private readonly documentAccessService = inject(DocumentAccessService);

  readonly assistant = this.state.currentAssistant;
  readonly documents = signal<DocumentItem[]>([]);

  constructor() {
    this.observeLinkedDocuments();
  }

  updateAssistant(payload: Partial<{ name: string; instructions: string }>): void {
    const assistant = this.state.currentAssistant();
    if (!assistant) {
      return;
    }
    this.assistantService.update(assistant.id, payload).subscribe(updated => {
      this.state.updateAssistant(updated);
    });
  }

  private observeLinkedDocuments(): void {
    effect(() => {
      const assistant = this.state.currentAssistant();
      const store = this.state.currentVectorStore();
      if (!assistant || !store) {
        this.documents.set([]);
        return;
      }
      const subscription = combineLatest([
        this.documentService.list(store.id),
        this.documentAccessService.list()
      ]).subscribe(([docs, links]) => {
        const linkedIds = new Set(links.filter(link => link.vector_store === store.id).map(link => link.document));
        this.documents.set(docs.filter(doc => linkedIds.has(doc.id)));
      });
      return () => subscription.unsubscribe();
    });
  }
}
