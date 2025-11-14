import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';
import { GlobalState } from './state/global.state';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe, NgIf],
  template: `
    <div class="min-h-screen bg-surface text-slate-100">
      <router-outlet />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly state = inject(GlobalState);
  readonly bootstrapped = signal(false);

  constructor() {
    this.auth.restoreSession();
    this.bootstrapped.set(true);
  }
}
