import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OpenaiKeyService } from '../../services/openai-key.service';
import { OpenAiKey } from '../../models/openai-key.model';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-openai-key-manager',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, ReactiveFormsModule],
  template: `
    <div class="flex h-full flex-col gap-6 px-6 py-6">
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 class="text-lg font-semibold">Add OpenAI API Key</h2>
        <form [formGroup]="form" (ngSubmit)="create()" class="mt-4 flex gap-3">
          <input formControlName="name" type="text" placeholder="Key label" class="w-48 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm" />
          <input formControlName="key" type="password" placeholder="sk-..." class="flex-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm" />
          <button class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" type="submit" [disabled]="form.invalid">
            Save
          </button>
        </form>
      </section>
      <section class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 class="text-lg font-semibold">Stored keys</h2>
        <ul class="mt-4 space-y-3">
          <li *ngFor="let key of keys()" class="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm">
            <div>
              <p class="font-semibold">{{ key.name }}</p>
              <p class="text-xs text-slate-400">{{ key.masked_key }}</p>
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
export class OpenaiKeyManagerComponent {
  private readonly service = inject(OpenaiKeyService);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);

  readonly keys = signal<OpenAiKey[]>([]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    key: ['', [Validators.required, Validators.minLength(10)]]
  });

  constructor() {
    this.load();
  }

  create(): void {
    if (this.form.invalid) {
      return;
    }
    const { name, key } = this.form.getRawValue();
    if (!name || !key) {
      return;
    }
    this.service.create({ name, key }).subscribe(createdKey => {
      this.keys.update(list => [...list, createdKey]);
      this.form.reset({ name: '', key: '' });
      this.notifications.push('success', 'Key added');
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
}
