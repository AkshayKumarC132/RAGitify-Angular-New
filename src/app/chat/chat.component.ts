import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, interval, of, startWith, switchMap, takeWhile, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatBarComponent } from '../chatbar/chat-bar.component';
import { MessageBubbleComponent } from './message-bubble.component';
import { RunStatusIndicatorComponent } from './run-status-indicator.component';
import { GlobalState } from '../state/global.state';
import { VectorStoreService } from '../services/vectorstore.service';
import { AssistantService } from '../services/assistant.service';
import { ThreadService } from '../services/thread.service';
import { MessageService } from '../services/message.service';
import { RunService } from '../services/run.service';
import { NotificationService } from '../services/notification.service';
import { ThreadItem } from '../models/thread.model';
import { Run } from '../models/run.model';
import { VectorStore } from '../models/vector-store.model';
import { Assistant } from '../models/assistant.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, DatePipe, ChatBarComponent, MessageBubbleComponent, RunStatusIndicatorComponent],
  template: `
    <div class="flex h-full flex-col">
      <header class="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <h2 class="text-base font-semibold">{{ threadTitle() }}</h2>
          <app-run-status-indicator [status]="state.runStatus()" />
        </div>
        <div class="flex items-center gap-3">
          <select
            class="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-200"
            [value]="mode()"
            (change)="onModeChange($event)"
          >
            <option value="normal">Normal</option>
            <option value="document">Document</option>
            <option value="web">Web</option>
          </select>
          <select
            class="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-200"
            [value]="model()"
            (change)="onModelChange($event)"
          >
            <option *ngFor="let option of models" [value]="option">{{ option }}</option>
          </select>
        </div>
      </header>
      <section class="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        <div class="mx-auto flex max-w-3xl flex-col gap-6">
          <app-message-bubble *ngFor="let message of state.messages()" [message]="message" />
        </div>
      </section>
      <footer class="border-t border-white/5 px-6 py-4">
        <app-chat-bar [disabled]="state.uploading() || isBusy()" (send)="handleSend($event)" />
        <p *ngIf="state.uploading()" class="mt-2 text-xs text-amber-300">
          Upload in progress — chat disabled until ingestion completes
        </p>
      </footer>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent {
  readonly state = inject(GlobalState);
  private readonly vectorStoreService = inject(VectorStoreService);
  private readonly assistantService = inject(AssistantService);
  private readonly threadService = inject(ThreadService);
  private readonly messageService = inject(MessageService);
  private readonly runService = inject(RunService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);

  readonly mode = signal<Mode>('normal');
  readonly model = signal('gpt-4o-mini');
  readonly models = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

  constructor() {
    this.bootstrap();

    effect(() => {
      const thread = this.state.currentThread();
      if (thread) {
        this.loadMessages(thread.id);
      }
    });

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        switchMap(params => {
          const threadId = params.get('id');
          if (threadId) {
            return this.threadService.retrieve(threadId);
          }
          return of<ThreadItem | null>(null);
        })
      )
      .subscribe(thread => {
        if (thread) {
          this.state.updateThread(thread);
        }
      });
  }

  threadTitle() {
    const thread = this.state.currentThread();
    return thread?.title ?? 'Untitled thread';
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  setModel(model: string): void {
    this.model.set(model);
    const assistant = this.state.currentAssistant();
    if (assistant) {
      this.assistantService.update(assistant.id, { model }).subscribe(updated => {
        this.state.updateAssistant(updated);
      });
    }
  }

  onModeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Mode;
    this.setMode(value);
  }

  onModelChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setModel(value);
  }

  handleSend(content: string): void {
    const thread = this.state.currentThread();
    const assistant = this.state.currentAssistant();
    if (!thread || !assistant) {
      this.notifications.push('warning', 'Chat is not ready yet.');
      return;
    }
    this.state.setRunStatus('in_progress');
    this.messageService
      .create({ thread_id: thread.id, content })
      .pipe(
        switchMap(message => {
          this.state.appendMessage(message);
          return this.runService.create({
            thread_id: thread.id,
            assistant_id: assistant.id,
            mode: this.mode(),
            message_id: message.id
          });
        }),
        catchError(error => {
          console.error('Failed to send message', error);
          this.state.setRunStatus(null);
          this.notifications.push('error', 'Unable to send your message. Please try again.');
          return EMPTY;
        })
      )
      .subscribe(run => {
        this.state.setRunStatus(run.status);
        this.startMessagePolling(run.thread);
        this.monitorRun(run);
      });
  }

  private bootstrap(): void {
    effect(() => {
      if (!this.state.sessionToken()) {
        return;
      }
      this.ensureVectorStore()
        .pipe(
          switchMap(store => this.ensureAssistant(store)),
          switchMap(result => this.ensureThread(result)),
          catchError(error => {
            console.error('Failed to bootstrap chat workspace', error);
            this.notifications.push('error', 'Unable to initialize your chat workspace.');
            return EMPTY;
          }),
          takeUntilDestroyed()
        )
        .subscribe(({ thread }) => this.state.updateThread(thread));
    });
  }

  private ensureVectorStore() {
    const current = this.state.currentVectorStore();
    if (current) {
      return of(current);
    }
    return this.vectorStoreService
      .create({ name: 'Default Vector Store' })
      .pipe(
        tap(store => this.state.updateVectorStore(store))
      );
  }

  private ensureAssistant(store: VectorStore) {
    const existing = this.state.currentAssistant();
    if (existing) {
      return of({ store, assistant: existing });
    }
    return this.assistantService
      .create({
        name: 'RAGitify Assistant',
        instructions: "You are a helpful assistant that uses the user's knowledge base.",
        model: this.model(),
        vector_store_id: store.id
      })
      .pipe(
        tap(assistant => this.state.updateAssistant(assistant)),
        switchMap(assistant => of({ store, assistant }))
      );
  }

  private ensureThread(data: { store: VectorStore; assistant: Assistant }) {
    const currentThread = this.state.currentThread();
    if (currentThread) {
      return of({ thread: currentThread });
    }
    return this.threadService
      .create({ title: 'New conversation', vector_store_id: data.store.id })
      .pipe(
        tap(thread => this.state.updateThread(thread)),
        switchMap(thread => of({ thread }))
      );
  }

  private loadMessages(threadId: string): void {
    this.messageService
      .list(threadId)
      .pipe(takeUntilDestroyed())
      .subscribe(messages => {
        this.state.setMessages(messages);
      });
  }

  isBusy(): boolean {
    const status = this.state.runStatus();
    return status === 'in_progress' || status === 'queued';
  }

  private monitorRun(run: Run): void {
    this.state.setActiveRun(run);
    this.state.setRunStatus(run.status);
    interval(2000)
      .pipe(
        startWith(0),
        switchMap(() => this.runService.retrieve(run.id)),
        tap(latest => {
          this.state.setActiveRun(latest);
          this.state.setRunStatus(latest.status);
          if (latest.status === 'requires_action') {
            this.handleRequiredAction(latest);
          }
          if (latest.status === 'completed') {
            this.messageService.list(latest.thread).subscribe(messages => this.state.setMessages(messages));
          }
          if (latest.status === 'failed') {
            this.notifications.push('error', 'Run failed');
          }
        }),
        takeWhile(runState => !['completed', 'failed', 'cancelled'].includes(runState.status), true),
        takeUntilDestroyed()
      )
      .subscribe({
        complete: () => this.state.setRunStatus(null),
        error: error => {
          console.error('Run polling failed', error);
          this.notifications.push('error', 'Lost connection while monitoring the run.');
          this.state.setRunStatus(null);
        }
      });
  }

  private startMessagePolling(threadId: string): void {
    interval(2000)
      .pipe(
        startWith(0),
        switchMap(() => this.messageService.list(threadId)),
        tap(messages => this.state.setMessages(messages)),
        takeWhile(() => {
          const status = this.state.runStatus();
          return status === 'queued' || status === 'in_progress' || status === 'requires_action';
        }, true),
        takeUntilDestroyed()
      )
      .subscribe({
        error: error => console.error('Message polling error', error)
      });
  }

  private handleRequiredAction(run: Run): void {
    if (!run.required_action || run.required_action.type !== 'submit_tool_outputs') {
      return;
    }
    this.notifications.push('warning', 'Assistant requires tool outputs. Please provide the requested information.');
  }
}

type Mode = 'normal' | 'document' | 'web';
