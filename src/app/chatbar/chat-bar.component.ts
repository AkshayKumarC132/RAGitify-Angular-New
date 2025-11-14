import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, Input, Output, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-bar',
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <form class="relative w-full" (ngSubmit)="onSubmit()">
      <div
        class="flex items-end gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-xl transition-all"
        [class.min-h-[112px]]="expanded()"
      >
        <textarea
          [(ngModel)]="draft"
          name="message"
          rows="expanded() ? 3 : 1"
          class="h-full w-full resize-none border-none bg-transparent text-sm text-slate-100 outline-none"
          placeholder="Message RAGitify..."
          (input)="handleInput()"
          [disabled]="disabled"
          aria-label="Message input"
        ></textarea>
        <button
          class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          type="submit"
          [disabled]="disabled || draft.trim().length === 0"
          aria-label="Send message"
        >
          <span class="material-icons">send</span>
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatBarComponent {
  @HostBinding('class') readonly hostClass = 'block w-full';
  @Input({ transform: (value: unknown) => Boolean(value) }) disabled = false;
  @Output() readonly send = new EventEmitter<string>();

  readonly expanded = signal(false);
  protected draft = '';

  private readonly hasSentFirstMessage = signal(false);

  handleInput(): void {
    if (!this.hasSentFirstMessage() && this.draft.trim().length > 0) {
      this.expanded.set(true);
    }
  }

  onSubmit(): void {
    const value = this.draft.trim();
    if (!value || this.disabled) {
      return;
    }
    this.send.emit(value);
    this.draft = '';
    this.hasSentFirstMessage.set(true);
    this.expanded.set(true);
  }
}
