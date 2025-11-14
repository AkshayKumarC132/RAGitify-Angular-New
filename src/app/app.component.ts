import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgIf],
  template: `
    <div class="min-h-screen bg-surface text-slate-100">
      <ng-container *ngIf="bootstrapped(); else loading">
        <router-outlet />
      </ng-container>
    </div>

    <ng-template #loading>
      <div class="flex min-h-screen items-center justify-center bg-surface text-slate-300">
        <span class="mr-3 h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent"></span>
        <span class="text-sm">Loading RAGitify…</span>
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly bootstrapped = signal(false);

  constructor() {
    const hasSession = this.auth.restoreSession();
    queueMicrotask(() => {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      if (!hasSession && currentPath !== '/auth') {
        this.router.navigateByUrl('/auth');
      }
      if (hasSession && (currentPath === '/' || currentPath === '/auth')) {
        this.router.navigateByUrl('/chat');
      }
      this.bootstrapped.set(true);
    });
  }
}
