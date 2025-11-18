import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OpenaiKeyService } from '../../services/openai-key.service';
import { OpenAiKey, OpenAiKeyCreateRequest, OpenAiProvider } from '../../models/openai-key.model';
import { NotificationService } from '../../services/notification.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-openai-key-manager',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, ReactiveFormsModule],
  template: `
    <div class="flex h-full flex-col gap-6 px-6 py-6">
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 class="text-lg font-semibold">Add API Key</h2>
        <form [formGroup]="form" (ngSubmit)="create()" class="mt-4 flex flex-wrap gap-3">
          <input
            formControlName="name"
            type="text"
            placeholder="Key label"
            class="w-48 min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm"
          />
          <select
            formControlName="provider"
            class="w-36 min-w-[10rem] rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm"
          >
            <option value="OpenAI">OpenAI</option>
            <option value="Ollama">Ollama</option>
          </select>
          <input
            formControlName="model"
            type="text"
            placeholder="Model (optional)"
            class="w-48 min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm"
          />
          <input
            formControlName="api_key"
            [type]="apiKeyInputType"
            [placeholder]="form.value.provider === 'Ollama' ? 'Not required for Ollama' : 'sk-...'"
            class="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm disabled:opacity-60"
            [disabled]="isOllamaProvider()"
          />
          <label class="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" formControlName="is_active" class="h-4 w-4 rounded border border-white/20 bg-slate-900/60" />
            Set as active key
          </label>
          <button class="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" type="submit" [disabled]="form.invalid">
            Save
          </button>
        </form>
      </section>
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 class="text-lg font-semibold">Stored keys</h2>
        <ul class="mt-4 space-y-3">
          <li *ngFor="let key of keys()" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm">
            <div>
              <p class="font-semibold">{{ key.name }}</p>
              <p class="text-xs text-slate-400">
                {{ key.provider }}
                <ng-container *ngIf="key.model"> • {{ key.model }}</ng-container>
                <ng-container *ngIf="key.masked_key"> • {{ key.masked_key }}</ng-container>
              </p>
            </div>
            <button class="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10" (click)="remove(key)">
              Delete
            </button>
          </li>
        </ul>
        <p *ngIf="keys().length === 0" class="text-sm text-slate-400">No keys stored yet.</p>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenaiKeyManagerComponent implements OnDestroy {
  private readonly service = inject(OpenaiKeyService);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly destroy$ = new Subject<void>();

  readonly keys = signal<OpenAiKey[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    provider: this.fb.nonNullable.control<OpenAiProvider>('OpenAI'),
    api_key: ['', [Validators.required, Validators.minLength(10)]],
    model: [''],
    is_active: this.fb.nonNullable.control(true)
  });

  readonly apiKeyInputType = 'password';

  constructor() {
    this.form.controls.provider.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(provider => {
      this.applyApiKeyValidation(provider);
    });
    this.applyApiKeyValidation(this.form.controls.provider.value);
    this.load();
  }

  create(): void {
    if (this.form.invalid) {
      return;
    }
    const { name, provider, api_key, model, is_active } = this.form.getRawValue();
    if (!name || !provider) {
      return;
    }
    const payload: OpenAiKeyCreateRequest = {
      name: name.trim(),
      provider,
      model: model?.trim() || undefined,
      is_active,
      ...(provider === 'OpenAI' && api_key ? { api_key: api_key.trim() } : {})
    };

    this.service.create(payload).subscribe({
      next: createdKey => {
        this.keys.update(list => [...list, createdKey]);
        this.form.reset({ name: '', provider, api_key: '', model: '', is_active });
        this.applyApiKeyValidation(provider);
        this.notifications.push('success', 'Key added');
      },
      error: () => {
        this.notifications.push('error', 'Failed to add key. Check details and try again.');
      }
    });
  }

  remove(key: OpenAiKey): void {
    this.service.delete(key.id).subscribe(() => {
      this.keys.update(list => list.filter(item => item.id !== key.id));
      this.notifications.push('success', 'Key removed');
    });
  }

  private load(): void {
    this.service.list().subscribe(keys => this.keys.set(keys));
  }

  private applyApiKeyValidation(provider: OpenAiProvider): void {
    const apiKeyControl = this.form.controls.api_key;
    if (provider === 'OpenAI') {
      apiKeyControl.setValidators([Validators.required, Validators.minLength(10)]);
      apiKeyControl.enable({ emitEvent: false });
    } else {
      apiKeyControl.setValidators([]);
      apiKeyControl.reset('', { emitEvent: false });
      apiKeyControl.disable({ emitEvent: false });
    }
    apiKeyControl.updateValueAndValidity({ emitEvent: false });
  }

  isOllamaProvider(): boolean {
    return this.form.controls.provider.value === 'Ollama';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
