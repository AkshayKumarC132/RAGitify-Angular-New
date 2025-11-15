import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ToastContainerComponent } from '../components/toast-container/toast-container.component';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, ToastContainerComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <app-toast-container />
      <div class="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl backdrop-blur">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-semibold text-white">RAGitify</h1>
          <button
            class="text-sm text-primary-foreground/80 hover:text-primary-foreground transition"
            type="button"
            (click)="toggleMode()"
          >
            {{ mode() === 'login' ? 'Need an account?' : 'Have an account?' }}
          </button>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-slate-300">Email</label>
            <input
              formControlName="email"
              type="email"
              class="w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-slate-300">Password</label>
            <input
              formControlName="password"
              type="password"
              class="w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>
          <ng-container *ngIf="mode() === 'register'">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">First name</label>
                <input
                  formControlName="first_name"
                  type="text"
                  class="w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">Last name</label>
                <input
                  formControlName="last_name"
                  type="text"
                  class="w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Tenant name</label>
              <input
                formControlName="tenant_name"
                type="text"
                class="w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                placeholder="acme-inc"
                required
              />
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Collection name</label>
              <input
                formControlName="collection_name"
                type="text"
                class="w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                placeholder="default_collection"
              />
              <p class="text-xs text-slate-400">Defaults to default_collection when left blank.</p>
            </div>
          </ng-container>
          <button
            class="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            type="submit"
            [disabled]="form.invalid || auth.pending()"
          >
            {{ mode() === 'login' ? 'Sign in' : 'Create account' }}
          </button>
        </form>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  protected readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  readonly mode = signal<'login' | 'register'>('login');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    first_name: [''],
    last_name: [''],
    tenant_name: [''],
    collection_name: ['']
  });

  constructor() {
    effect(() => {
      if (this.auth.pending()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });

    effect(() => {
      const tenant = this.form.get('tenant_name');
      if (!tenant) {
        return;
      }
      if (this.mode() === 'register') {
        tenant.addValidators(Validators.required);
      } else {
        tenant.clearValidators();
      }
      tenant.updateValueAndValidity({ emitEvent: false });
    });
  }

  toggleMode(): void {
    const next = this.mode() === 'login' ? 'register' : 'login';
    this.mode.set(next);
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const request$ =
      this.mode() === 'login'
        ? this.auth.login({ email: value.email, password: value.password })
        : this.auth.register({
            email: value.email,
            password: value.password,
            tenant_name: value.tenant_name,
            first_name: value.first_name || undefined,
            last_name: value.last_name || undefined,
            collection_name: value.collection_name || undefined
          });

    request$.subscribe({
      error: () => {
        const message =
          this.mode() === 'login'
            ? 'Unable to sign in with those credentials.'
            : 'Account creation failed. Please verify your details.';
        this.notifications.push('error', message);
      }
    });
  }
}
