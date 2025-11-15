import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import { UserProfile } from '../models/auth.model';
import { VectorStore } from '../models/vector-store.model';
import { Assistant } from '../models/assistant.model';
import { ThreadItem } from '../models/thread.model';
import { MessageItem } from '../models/message.model';
import { Run, RunStatus } from '../models/run.model';

@Injectable({ providedIn: 'root' })
export class GlobalState {
  private readonly _sessionToken = signal<string | null>(null);
  private readonly _currentUser = signal<UserProfile | null>(null);
  private readonly _currentProjectId = signal<string | null>(null);
  private readonly _currentVectorStore = signal<VectorStore | null>(null);
  private readonly _currentAssistant = signal<Assistant | null>(null);
  private readonly _currentThread = signal<ThreadItem | null>(null);
  private readonly _messages: WritableSignal<MessageItem[]> = signal([]);
  private readonly _uploading = signal(false);
  private readonly _runStatus = signal<RunStatus | null>(null);
  private readonly _activeRun = signal<Run | null>(null);

  readonly sessionToken = this._sessionToken.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly currentProjectId = this._currentProjectId.asReadonly();
  readonly currentVectorStore = this._currentVectorStore.asReadonly();
  readonly currentAssistant = this._currentAssistant.asReadonly();
  readonly currentThread = this._currentThread.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly uploading = this._uploading.asReadonly();
  readonly runStatus = this._runStatus.asReadonly();
  readonly activeRun = this._activeRun.asReadonly();

  readonly isAuthenticated = computed(() => this._sessionToken() !== null);

  setSession(token: string | null, user: UserProfile | null): void {
    this._sessionToken.set(token);
    this._currentUser.set(user);
  }

  setProjectId(projectId: string | null): void {
    this._currentProjectId.set(projectId);
  }

  resetWorkspace(): void {
    this._currentProjectId.set(null);
    this._currentVectorStore.set(null);
    this._currentAssistant.set(null);
    this._currentThread.set(null);
    this._messages.set([]);
    this._uploading.set(false);
    this._runStatus.set(null);
    this._activeRun.set(null);
  }

  updateVectorStore(store: VectorStore | null): void {
    this._currentVectorStore.set(store);
  }

  updateAssistant(assistant: Assistant | null): void {
    this._currentAssistant.set(assistant);
  }

  updateThread(thread: ThreadItem | null): void {
    this._currentThread.set(thread);
  }

  setMessages(messages: MessageItem[]): void {
    this._messages.set(messages);
  }

  appendMessage(message: MessageItem): void {
    this._messages.update(list => [...list, message]);
  }

  setUploading(value: boolean): void {
    this._uploading.set(value);
  }

  setRunStatus(status: RunStatus | null): void {
    this._runStatus.set(status);
  }

  setActiveRun(run: Run | null): void {
    this._activeRun.set(run);
  }
}
