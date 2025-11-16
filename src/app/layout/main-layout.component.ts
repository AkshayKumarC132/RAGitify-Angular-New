import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ProjectPanelComponent } from '../project-panel/project-panel.component';
import { ToastContainerComponent } from '../components/toast-container/toast-container.component';
import { GlobalState } from '../state/global.state';
import { AuthService } from '../services/auth.service';

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

  logout(): void {
    this.auth.logout();
  }
}
