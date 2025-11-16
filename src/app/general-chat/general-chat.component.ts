import { AsyncPipe, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GlobalState } from '../state/global.state';
import { ThreadService } from '../services/thread.service';
import { MessageService } from '../services/message.service';
import { VectorStoreService } from '../services/vectorstore.service';
import { NotificationService } from '../services/notification.service';
import { ThreadItem } from '../models/thread.model';
import { MessageItem } from '../models/message.model';
import { Subscription, forkJoin, of, switchMap, timer } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { VectorStore } from '../models/vector-store.model';
import { AssistantService } from '../services/assistant.service';
import { Run } from '../models/run.model';
import { RunService } from '../services/run.service';
import { DocumentService } from '../services/document.service';

@Component({
  selector: 'app-general-chat',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, DatePipe, NgClass, ReactiveFormsModule, FormsModule],
  template: `
    <div class="flex h-full">
      <aside class="hidden w-72 flex-shrink-0 flex-col border-r border-white/10 bg-slate-950/70 p-4 md:flex">
        <header class="flex items-center justify-between"> 
          <h2 class="text-sm font-semibold text-slate-200">Threads</h2>
          <button class="rounded-lg border border-white/10 px-2 py-1 text-xs" (click)="createNewChat()">New</button>
        </header>
        <input
          type="search"
          [(ngModel)]="threadQuery"
          (ngModelChange)="filterThreads()"
          placeholder="Search threads"
          class="mt-3 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
        />
        <ul class="mt-3 flex-1 space-y-2 overflow-y-auto text-sm">
          <li
            *ngFor="let thread of filteredThreads()"
            (click)="selectThread(thread)"
            class="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition"
            [ngClass]="{
              'border-primary bg-white/10': selectedThread()?.id === thread.id,
              'border-white/10': selectedThread()?.id !== thread.id
            }"
          >
            <div class="min-w-0">
              <p class="truncate font-medium">{{ thread.title ?? 'Untitled thread' }}</p>
              <p class="text-xs text-slate-500">Updated {{ thread.created_at | date: 'short' }}</p>
            </div>
            <span class="material-icons text-base text-slate-400">chevron_right</span>
          </li>
          <li *ngIf="filteredThreads().length === 0" class="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
            No threads yet.
          </li>
        </ul>
      </aside>
      <section class="flex flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h1 class="text-lg font-semibold">{{ selectedThread()?.title ?? 'Select a thread' }}</h1>
            <p class="text-sm text-slate-400">Manage ad-hoc conversations independent of project chat.</p>
          </div>
          <button class="rounded-lg border border-white/10 px-3 py-1 text-sm" (click)="createNewChat()">Create thread</button>
        </header>
        <div class="flex-1 overflow-y-auto bg-slate-950/50 px-6 py-4">
          <div class="mx-auto flex max-w-3xl flex-col gap-4">
            <article *ngFor="let message of messages()" class="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
              <header class="flex items-center justify-between text-xs text-slate-500">
                <span class="uppercase tracking-widest">{{ message.role }}</span>
                <span>{{ message.created_at | date: 'short' }}</span>
              </header>
              <p class="mt-2 whitespace-pre-wrap text-sm text-slate-200">{{ message.content }}</p>
            </article>
            <p *ngIf="messages().length === 0" class="py-10 text-center text-sm text-slate-400">No messages yet.</p>
            <div *ngIf="activeRuns().length" class="space-y-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-slate-200">
              <div class="flex items-center justify-between text-xs uppercase tracking-widest text-primary">
                <span>Run Progress</span>
                <span>{{ activeRuns().length }} active</span>
              </div>
              <div *ngFor="let run of activeRuns()" class="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
                <div class="flex items-center justify-between text-xs text-slate-400">
                  <span>{{ run.mode }} mode</span>
                  <span>{{ run.status }}</span>
                </div>
                <p class="mt-1 text-[13px] text-slate-300">Run ID: {{ run.id }}</p>
              </div>
            </div>
            <p *ngIf="assistantPending()" class="py-4 text-center text-xs uppercase tracking-widest text-slate-400 animate-pulse">
              Waiting for assistant response…
            </p>
          </div>
        </div>
        <footer class="border-t border-white/10 px-6 py-4">
          <form [formGroup]="messageForm" (ngSubmit)="sendMessage()" class="mx-auto flex max-w-3xl gap-3">
            <textarea
              formControlName="content"
              rows="3"
              placeholder="Write a message…"
              class="flex-1 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
            ></textarea>
            <button
              class="h-fit rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              type="submit"
              [disabled]="messageForm.invalid || !selectedThread()"
            >
              Send
            </button>
          </form>
        </footer>
      </section>
    </div>

  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneralChatComponent implements OnDestroy {
  private readonly state = inject(GlobalState);
  private readonly threadService = inject(ThreadService);
  private readonly messageService = inject(MessageService);
  private readonly vectorStoreService = inject(VectorStoreService);
  private readonly assistantService = inject(AssistantService);
  private readonly runService = inject(RunService);
  private readonly documentService = inject(DocumentService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly threads = signal<ThreadItem[]>([]);
  readonly filteredThreads = signal<ThreadItem[]>([]);
  readonly selectedThread = signal<ThreadItem | null>(null);
  readonly messages = signal<MessageItem[]>([]);
  readonly vectorStores = signal<VectorStore[]>([]);
  readonly runs = signal<Run[]>([]);
  readonly assistantPending = signal(false);

  private assistantPolling: Subscription | null = null;
  private lastKnownAssistantIds = new Set<number>();
  private generalStoreIds = new Set<string>();

  threadQuery = '';

  readonly messageForm = this.fb.group({
    content: ['', [Validators.required, Validators.minLength(1)]]
  });

  constructor() {
    effect(() => {
      if (!this.state.sessionToken()) {
        this.threads.set([]);
        this.filteredThreads.set([]);
        this.messages.set([]);
        this.runs.set([]);
        this.stopAssistantPolling();
        return;
      }
      this.loadVectorStores();
    });

    effect(() => {
      const thread = this.selectedThread();
      this.stopAssistantPolling();
      if (thread) {
        this.loadMessages(thread.id);
        this.loadRuns(thread.id);
      } else {
        this.messages.set([]);
        this.runs.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAssistantPolling();
  }

  createNewChat(): void {
    this.notifications.push('info', 'Preparing a new chat workspace…');
    const timestamp = new Date().toISOString();
    const storeName = `General Chat ${timestamp}`;
    this.vectorStoreService
      .create({ name: storeName })
      .pipe(
        switchMap(store => {
          this.generalStoreIds.add(store.id);
          this.vectorStores.update(list => [store, ...list]);
          return this.assistantService.create({
            name: 'General Chat Assistant',
            instructions: 'You are a helpful assistant for general conversations.',
            model: 'gpt-4o-mini',
            vector_store_id: store.id
          }).pipe(map(assistant => ({ store, assistant })));
        }),
        switchMap(({ store, assistant }) =>
          this.threadService.create({ vector_store_id: store.id }).pipe(map(thread => ({ store, assistant, thread })))
        ),
        tap(({ thread }) => {
          this.notifications.push('success', 'New chat is ready.');
          this.threads.update(list => [thread, ...list]);
          this.filterThreads();
          this.selectThread(thread);
        }),
        catchError(error => {
          console.error('Failed to start general chat', error);
          this.notifications.push('error', 'Unable to create a new chat.');
          return of(null);
        })
      )
      .subscribe();
  }

  selectThread(thread: ThreadItem): void {
    this.selectedThread.set(thread);
    this.threadQuery = '';
    this.filterThreads();
  }

  sendMessage(): void {
    if (this.messageForm.invalid || !this.selectedThread()) {
      return;
    }
    const thread = this.selectedThread();
    const content = this.messageForm.value.content ?? '';
    if (!thread || !content.trim()) {
      return;
    }
    const knownAssistantIds = new Set(
      this.messages()
        .filter(message => message.role === 'assistant')
        .map(message => message.id)
    );
    this.messageService.create({ thread_id: thread.id, content }).subscribe({
      next: message => {
        this.notifications.push('success', 'Message sent.');
        this.messageForm.reset({ content: '' });
        this.messages.update(list => [...list, message]);
        this.lastKnownAssistantIds = knownAssistantIds;
        this.startAssistantPolling(thread.id);
      },
      error: error => {
        console.error('Failed to send message', error);
        this.notifications.push('error', 'Unable to send message.');
      }
    });
  }

  filterThreads(): void {
    const query = this.threadQuery.toLowerCase();
    const source = this.threads();
    const filtered = source.filter(thread => (thread.title ?? 'Untitled thread').toLowerCase().includes(query));
    this.filteredThreads.set(filtered);
  }

  private loadThreads(): void {
    this.threadService.list().subscribe({
      next: threads => {
        const generalThreads = threads.filter(thread => this.generalStoreIds.has(thread.vector_store_id_read));
        this.threads.set(generalThreads);
        this.filteredThreads.set(generalThreads);
        if (!this.selectedThread() && generalThreads.length) {
          this.selectedThread.set(generalThreads[0]);
        }
      },
      error: error => {
        console.error('Failed to load threads', error);
        this.notifications.push('error', 'Unable to load threads.');
      }
    });
  }

  private loadMessages(threadId: string): void {
    this.messageService.list(threadId).subscribe({
      next: messages => {
        this.messages.set(messages);
        this.updateLastKnownAssistantIds(messages);
        const lastMessage = messages.at(-1);
        if (lastMessage?.role === 'user') {
          this.startAssistantPolling(threadId);
        } else {
          this.stopAssistantPolling();
        }
      },
      error: error => {
        console.error('Failed to load messages', error);
        this.notifications.push('error', 'Unable to load messages.');
      }
    });
  }

  private loadVectorStores(): void {
    this.vectorStoreService
      .list()
      .pipe(
        switchMap(stores => {
          if (!stores.length) {
            return of({ stores, generalIds: new Set<string>() });
          }
          const checks = stores.map(store =>
            this.documentService
              .list(store.id)
              .pipe(
                map(docs => ({ id: store.id, hasDocs: docs.length > 0 })),
                catchError(() => of({ id: store.id, hasDocs: true }))
              )
          );
          return forkJoin(checks).pipe(
            map(results => {
              const generalIds = new Set(results.filter(result => !result.hasDocs).map(result => result.id));
              return { stores, generalIds };
            })
          );
        })
      )
      .subscribe({
        next: ({ stores, generalIds }) => {
          this.vectorStores.set(stores);
          this.generalStoreIds = generalIds;
          this.loadThreads();
        },
        error: error => {
          console.error('Failed to load vector stores', error);
          this.notifications.push('error', 'Unable to load vector stores.');
        }
      });
  }

  private startAssistantPolling(threadId: string): void {
    this.stopAssistantPolling();
    this.assistantPending.set(true);
    this.assistantPolling = timer(1000, 2000)
      .pipe(
        switchMap(() =>
          forkJoin({
            messages: this.messageService.list(threadId),
            runs: this.runService.list(threadId)
          })
        )
      )
      .subscribe({
        next: ({ messages, runs }) => {
          this.messages.set(messages);
          this.runs.set(runs);
          const hasNewAssistant = messages.some(message => message.role === 'assistant' && !this.lastKnownAssistantIds.has(message.id));
          const hasActiveRuns = runs.some(run => run.status !== 'completed' && run.status !== 'failed' && run.status !== 'cancelled');
          if (hasNewAssistant || !hasActiveRuns) {
            this.updateLastKnownAssistantIds(messages);
            this.stopAssistantPolling();
          }
        },
        error: error => {
          console.error('Failed to poll messages', error);
          this.notifications.push('error', 'Unable to retrieve assistant response.');
          this.stopAssistantPolling();
        }
      });
  }

  private stopAssistantPolling(): void {
    if (this.assistantPolling) {
      this.assistantPolling.unsubscribe();
      this.assistantPolling = null;
    }
    this.assistantPending.set(false);
  }

  private loadRuns(threadId: string): void {
    this.runService.list(threadId).subscribe({
      next: runs => this.runs.set(runs),
      error: error => console.error('Failed to load runs', error)
    });
  }

  activeRuns(): Run[] {
    return this.runs().filter(run => run.status !== 'completed' && run.status !== 'failed' && run.status !== 'cancelled');
  }

  private updateLastKnownAssistantIds(messages: MessageItem[]): void {
    this.lastKnownAssistantIds = new Set(messages.filter(message => message.role === 'assistant').map(message => message.id));
  }
}
