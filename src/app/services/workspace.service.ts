import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { VectorStoreService } from './vectorstore.service';
import { AssistantService } from './assistant.service';
import { ThreadService } from './thread.service';
import { VectorStore } from '../models/vector-store.model';
import { Assistant } from '../models/assistant.model';
import { ThreadItem } from '../models/thread.model';
import { GlobalState } from '../state/global.state';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly vectorStoreService = inject(VectorStoreService);
  private readonly assistantService = inject(AssistantService);
  private readonly threadService = inject(ThreadService);
  private readonly state = inject(GlobalState);

  private bootstrap$?: Observable<void>;

  bootstrap(): Observable<void> {
    if (!this.state.sessionToken()) {
      return of(void 0);
    }
    if (!this.bootstrap$) {
      this.state.setWorkspaceReady(false);
      const existingThreadId = this.readThreadIdFromUrl();
      const pipeline = (existingThreadId ? this.hydrateFromThread(existingThreadId) : this.bootstrapFreshWorkspace())
        .pipe(shareReplay(1));
      this.bootstrap$ = pipeline.pipe(
        catchError(error => {
          this.bootstrap$ = undefined;
          this.state.setWorkspaceReady(false);
          return throwError(() => error);
        })
      );
    }
    return this.bootstrap$;
  }

  reset(): void {
    this.bootstrap$ = undefined;
    this.state.setWorkspaceReady(false);
  }

  hydrateFromThread(threadId: string): Observable<void> {
    return this.threadService.retrieve(threadId).pipe(
      switchMap(thread =>
        this.vectorStoreService.retrieve(thread.vector_store_id_read).pipe(
          switchMap(store =>
            this.ensureAssistantForStore(store).pipe(
              tap(assistant => {
                this.state.updateVectorStore(store);
                this.state.setProjectId(store.id);
                this.state.updateAssistant(assistant);
                this.state.updateThread(thread);
              }),
              tap(() => this.state.setWorkspaceReady(true)),
              map(() => void 0)
            )
          )
        )
      )
    );
  }

  private bootstrapFreshWorkspace(): Observable<void> {
    return this.ensureVectorStore().pipe(
      switchMap(store => this.ensureAssistant(store)),
      switchMap(({ store, assistant }) => this.ensureThread(store, assistant)),
      tap(() => this.state.setWorkspaceReady(true)),
      map(() => void 0)
    );
  }

  private ensureVectorStore(): Observable<VectorStore> {
    const current = this.state.currentVectorStore();
    if (current) {
      this.state.setProjectId(current.id);
      return of(current);
    }
    return this.vectorStoreService.list().pipe(
      map(stores => stores.at(0) ?? null),
      switchMap(store => {
        if (store) {
          return of(store);
        }
        return this.vectorStoreService.create({ name: 'Default Vector Store' });
      }),
      tap(store => {
        this.state.updateVectorStore(store);
        this.state.setProjectId(store.id);
      })
    );
  }

  private ensureAssistant(store: VectorStore): Observable<{ store: VectorStore; assistant: Assistant }> {
    return this.ensureAssistantForStore(store).pipe(map(assistant => ({ store, assistant })));
  }

  private ensureThread(store: VectorStore, assistant: Assistant): Observable<{ store: VectorStore; assistant: Assistant; thread: ThreadItem }> {
    const current = this.state.currentThread();
    if (current && current.vector_store_id_read === store.id) {
      this.state.updateThread(current);
      return of({ store, assistant, thread: current });
    }
    return this.threadService
      .list(store.id)
      .pipe(
        map(threads => threads.at(0) ?? null),
        switchMap(thread => {
          if (thread) {
            return of(thread);
          }
          return this.threadService.create({ vector_store_id: store.id });
        }),
        tap(thread => this.state.updateThread(thread)),
        map(thread => ({ store, assistant, thread }))
      );
  }

  private resolveAssistantStoreId(assistant: Assistant): string | null {
    return assistant.vector_store_id ?? assistant.vector_store_id_read ?? assistant.vector_store ?? null;
  }

  private ensureAssistantForStore(store: VectorStore): Observable<Assistant> {
    const current = this.state.currentAssistant();
    if (current && this.resolveAssistantStoreId(current) === store.id) {
      return of(current);
    }
    return this.assistantService.list().pipe(
      map(list => list.find(item => this.resolveAssistantStoreId(item) === store.id) ?? null),
      switchMap(assistant => {
        if (assistant) {
          return of(assistant);
        }
        return this.assistantService.create({
          name: 'RAGitify Assistant',
          instructions: "You are a helpful assistant that uses the user's knowledge base.",
          model: 'gpt-4o-mini',
          vector_store_id: store.id
        });
      }),
      tap(assistant => this.state.updateAssistant(assistant))
    );
  }

  private readThreadIdFromUrl(): string | null {
    const match = location.pathname.match(/\/chat\/([^/]+)/);
    return match ? match[1] : null;
  }
}
