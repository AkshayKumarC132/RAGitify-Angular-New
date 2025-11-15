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
import { Subscription, switchMap, timer } from 'rxjs';
import { VectorStore } from '../models/vector-store.model';

@Component({
  selector: 'app-general-chat',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, DatePipe, NgClass, ReactiveFormsModule, FormsModule],
  template: `
    <div class="flex h-full">
      <aside class="hidden w-72 flex-shrink-0 flex-col border-r border-white/10 bg-slate-950/70 p-4 md:flex">
        <header class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-200">Threads</h2>
          <button class="rounded-lg border border-white/10 px-2 py-1 text-xs" (click)="openThreadModal()">New</button>
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
          <button class="rounded-lg border border-white/10 px-3 py-1 text-sm" (click)="openThreadModal()">Create thread</button>
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

    <section *ngIf="showThreadModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div class="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <h3 class="text-lg font-semibold">Create thread</h3>
        <p class="mt-1 text-sm text-slate-400">Choose a vector store for the new thread.</p>
        <form [formGroup]="threadForm" (ngSubmit)="createThread()" class="mt-4 space-y-4">
          <div>
            <label class="text-xs uppercase tracking-widest text-slate-500">Vector store</label>
            <select formControlName="vector_store_id" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm">
              <option value="" disabled>Select a vector store</option>
              <option *ngFor="let store of vectorStores()" [value]="store.id">{{ store.name }}</option>
            </select>
          </div>
          <footer class="flex justify-end gap-3">
            <button type="button" class="rounded-lg border border-white/10 px-3 py-2 text-sm" (click)="closeThreadModal()">Cancel</button>
            <button
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              type="submit"
              [disabled]="threadForm.invalid"
            >
              Create
            </button>
          </footer>
        </form>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneralChatComponent implements OnDestroy {
  private readonly state = inject(GlobalState);
  private readonly threadService = inject(ThreadService);
  private readonly messageService = inject(MessageService);
  private readonly vectorStoreService = inject(VectorStoreService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly threads = signal<ThreadItem[]>([]);
  readonly filteredThreads = signal<ThreadItem[]>([]);
  readonly selectedThread = signal<ThreadItem | null>(null);
  readonly messages = signal<MessageItem[]>([]);
  readonly vectorStores = signal<VectorStore[]>([]);
  readonly showThreadModal = signal(false);
  readonly assistantPending = signal(false);

  private assistantPolling: Subscription | null = null;
  private lastKnownAssistantIds = new Set<number>();

  threadQuery = '';

  readonly threadForm = this.fb.group({
    vector_store_id: ['', Validators.required]
  });

  readonly messageForm = this.fb.group({
    content: ['', [Validators.required, Validators.minLength(1)]]
  });

  constructor() {
    effect(() => {
      if (!this.state.sessionToken()) {
        this.threads.set([]);
        this.filteredThreads.set([]);
        this.messages.set([]);
        this.stopAssistantPolling();
        return;
      }
      this.loadThreads();
      this.loadVectorStores();
    });

    effect(() => {
      const thread = this.selectedThread();
      this.stopAssistantPolling();
      if (thread) {
        this.loadMessages(thread.id);
      } else {
        this.messages.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAssistantPolling();
  }

  openThreadModal(): void {
    const defaultStore = this.vectorStores()[0]?.id ?? '';
    this.threadForm.reset({ vector_store_id: defaultStore });
    this.showThreadModal.set(true);
  }

  closeThreadModal(): void {
    this.showThreadModal.set(false);
  }

  createThread(): void {
    if (this.threadForm.invalid) {
      this.threadForm.markAllAsTouched();
      return;
    }
    const payload = this.threadForm.getRawValue();
    this.threadService
      .create({
        vector_store_id: payload.vector_store_id!
      })
      .subscribe({
        next: thread => {
          this.notifications.push('success', 'Thread created.');
          this.threads.update(list => [thread, ...list]);
          this.filterThreads();
          this.selectThread(thread);
          this.closeThreadModal();
        },
        error: error => {
          console.error('Failed to create thread', error);
          this.notifications.push('error', 'Unable to create the thread.');
        }
      });
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
        this.threads.set(threads);
        this.filteredThreads.set(threads);
        if (!this.selectedThread() && threads.length) {
          this.selectedThread.set(threads[0]);
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
    this.vectorStoreService.list().subscribe({
      next: stores => {
        this.vectorStores.set(stores);
        if (!this.threadForm.value.vector_store_id && stores.length) {
          this.threadForm.patchValue({ vector_store_id: stores[0].id }, { emitEvent: false });
        }
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
      .pipe(switchMap(() => this.messageService.list(threadId)))
      .subscribe({
        next: messages => {
          this.messages.set(messages);
          const hasNewAssistant = messages.some(message => message.role === 'assistant' && !this.lastKnownAssistantIds.has(message.id));
          if (hasNewAssistant) {
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

  private updateLastKnownAssistantIds(messages: MessageItem[]): void {
    this.lastKnownAssistantIds = new Set(messages.filter(message => message.role === 'assistant').map(message => message.id));
  }
}
