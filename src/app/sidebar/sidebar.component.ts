import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, Output, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThreadService } from '../services/thread.service';
import { GlobalState } from '../state/global.state';
import { ThreadItem } from '../models/thread.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgFor, NgIf, AsyncPipe, NgClass, FormsModule, MatTooltipModule],
  template: `
    <aside
      class="flex h-screen flex-col overflow-hidden bg-slate-950/80 backdrop-blur transition-[width] duration-300"
      [ngClass]="collapsed() ? 'w-16' : 'w-72'"
    >
      <div class="flex items-center justify-between px-4 py-4">
        <button
          class="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/5"
          (click)="createNewChat()"
          [attr.aria-label]="collapsed() ? 'New chat' : null"
        >
          <span *ngIf="!collapsed(); else icon">New Chat</span>
          <ng-template #icon>
            <span class="material-icons text-xl">add</span>
          </ng-template>
        </button>
        <button
          class="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5"
          (click)="toggle()"
          aria-label="Toggle sidebar"
        >
          <span class="material-icons">{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</span>
        </button>
      </div>
      <div class="px-4" *ngIf="!collapsed()">
        <label class="sr-only">Search chats</label>
        <input
          type="search"
          [(ngModel)]="query"
          (ngModelChange)="applyFilter()"
          class="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-primary focus:outline-none"
          placeholder="Search chats"
        />
      </div>
      <nav class="flex-1 overflow-y-auto px-2 py-4 space-y-6 scrollbar-thin">
        <div>
          <h2 class="px-2 text-xs uppercase tracking-widest text-slate-500" *ngIf="!collapsed()">Projects</h2>
          <ul class="mt-3 space-y-1">
            <li>
              <a
                routerLink="/projects"
                routerLinkActive="bg-white/10"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                [matTooltip]="collapsed() ? 'Projects' : ''"
              >
                <span class="material-icons text-lg">workspaces</span>
                <span *ngIf="!collapsed()">See Projects</span>
              </a>
            </li>
            <li>
              <a
                routerLink="/library"
                routerLinkActive="bg-white/10"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                [matTooltip]="collapsed() ? 'Library' : ''"
              >
                <span class="material-icons text-lg">library_books</span>
                <span *ngIf="!collapsed()">Document Library</span>
              </a>
            </li>
            <li>
              <a
                routerLink="/general-chat"
                routerLinkActive="bg-white/10"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                [matTooltip]="collapsed() ? 'General chat' : ''"
              >
                <span class="material-icons text-lg">forum</span>
                <span *ngIf="!collapsed()">General Chat</span>
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 class="px-2 text-xs uppercase tracking-widest text-slate-500" *ngIf="!collapsed()">Recent Threads</h2>
          <ul class="space-y-1">
            <li *ngFor="let thread of filteredThreads()">
              <div class="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5">
                <a
                  [routerLink]="['/chat', thread.id]"
                  class="flex flex-1 items-center gap-3 text-sm text-slate-300"
                  [matTooltip]="collapsed() ? (thread.title ?? 'Untitled thread') : ''"
                >
                  <span class="material-icons text-lg">chat_bubble</span>
                  <span *ngIf="!collapsed()" class="truncate">{{ thread.title ?? 'Untitled thread' }}</span>
                </a>
                <div class="flex items-center gap-1" *ngIf="!collapsed()">
                  <button
                    type="button"
                    class="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                    (click)="editThread(thread, $event)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="rounded border border-red-500/40 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
                    (click)="deleteThread(thread, $event)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </nav>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  @HostBinding('class') readonly hostClass = 'h-full';
  protected readonly threadsSignal = signal<ThreadItem[]>([]);
  protected readonly collapsed = signal(false);
  protected query = '';

  private readonly threadService = inject(ThreadService);
  private readonly state = inject(GlobalState);
  private readonly router = inject(Router);

  readonly filteredThreads = signal<ThreadItem[]>([]);
  @Output() readonly newChat = new EventEmitter<void>();

  constructor() {
    effect(() => {
      if (!this.state.workspaceReady()) {
        this.threadsSignal.set([]);
        this.filteredThreads.set([]);
        return;
      }
      const vectorStore = this.state.currentVectorStore();
      const subscription = this.threadService.list(vectorStore?.id).subscribe(threads => {
        this.threadsSignal.set(threads);
        this.applyFilter();
      });
      return () => subscription.unsubscribe();
    });
  }

  toggle(): void {
    this.collapsed.update(value => !value);
  }

  createNewChat(): void {
    const assistant = this.state.currentAssistant();
    const vectorStore = this.state.currentVectorStore();
    if (!assistant || !vectorStore) {
      this.router.navigate(['/chat']);
      return;
    }
    this.threadService
      .create({
        vector_store_id: vectorStore.id
      })
      .subscribe(thread => {
        this.state.updateThread(thread);
        this.router.navigate(['/chat', thread.id]);
        this.newChat.emit();
      });
  }

  applyFilter(): void {
    const q = this.query.toLowerCase();
    const filtered = this.threadsSignal()
      .filter(thread => (thread.title ?? 'Untitled thread').toLowerCase().includes(q))
      .slice(0, 20);
    this.filteredThreads.set(filtered);
  }

  editThread(thread: ThreadItem, event: Event): void {
    event.stopPropagation();
    const proposed = window.prompt('Rename chat', thread.title ?? '');
    if (proposed === null) {
      return;
    }
    const title = proposed.trim();
    if (!title) {
      return;
    }
    this.threadService.update(thread.id, { title }).subscribe(updated => {
      this.threadsSignal.update(list => list.map(item => (item.id === thread.id ? updated : item)));
      this.applyFilter();
    });
  }

  deleteThread(thread: ThreadItem, event: Event): void {
    event.stopPropagation();
    if (!window.confirm('Delete this chat thread?')) {
      return;
    }
    this.threadService.delete(thread.id).subscribe(() => {
      this.threadsSignal.update(list => list.filter(item => item.id !== thread.id));
      this.applyFilter();
    });
  }
}
