import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ProjectPanelComponent } from '../project-panel/project-panel.component';
import { ToastContainerComponent } from '../components/toast-container/toast-container.component';
import { GlobalState } from '../state/global.state';
import { AuthService } from '../services/auth.service';
import { WorkspaceService } from '../services/workspace.service';
import { NotificationService } from '../services/notification.service';
import { EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ProjectPanelComponent, ToastContainerComponent, NgIf, AsyncPipe],
  template: `
    <app-toast-container />
    <div class="grid min-h-screen grid-cols-[auto_1fr_auto] bg-surface text-slate-100">
      <app-sidebar class="border-r border-white/5" />
      <main class="relative flex flex-col">
        <header class="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h1 class="text-lg font-semibold">{{ heading() }}</h1>
            <p class="text-sm text-slate-400">{{ subheading() }}</p>
          </div>
          <button class="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/5" (click)="logout()">
            Logout
          </button>
        </header>
        <section class="flex-1 overflow-y-auto">
          <router-outlet />
        </section>
      </main>
      <app-project-panel class="border-l border-white/5" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  private readonly state = inject(GlobalState);
  private readonly auth = inject(AuthService);
  private readonly workspace = inject(WorkspaceService);
  private readonly notifications = inject(NotificationService);

  readonly heading = computed(() => {
    const route = location.pathname;
    if (route.includes('library')) {
      return 'Document Library';
    }
    if (route.includes('projects')) {
      return 'Projects';
    }
    if (route.includes('keys')) {
      return 'API Keys';
    }
    return 'Chat';
  });

  readonly subheading = computed(() => {
    const user = this.state.currentUser();
    return user ? `Welcome back, ${user.first_name ?? user.email}` : 'Welcome to RAGitify';
  });

  constructor() {
    effect(() => {
      if (!this.state.sessionToken()) {
        return;
      }
      this.workspace
        .bootstrap()
        .pipe(
          catchError(error => {
            console.error('Workspace bootstrap failed', error);
            this.notifications.push('error', 'Unable to prepare your workspace.');
            return EMPTY;
          }),
          takeUntilDestroyed()
        )
        .subscribe();
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
