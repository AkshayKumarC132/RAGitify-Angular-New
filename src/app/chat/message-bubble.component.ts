import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MessageItem } from '../models/message.model';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [NgClass, DatePipe],
  template: `
    <article
      class="flex gap-4"
      [ngClass]="message.role === 'user' ? 'flex-row-reverse text-right' : 'flex-row text-left'"
    >
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm uppercase text-white/80">
        {{ message.role === 'user' ? 'You' : 'AI' }}
      </div>
      <div
        class="max-w-3xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed shadow"
        [ngClass]="{
          'bg-primary/10 border-primary/40 text-primary-foreground': message.role === 'assistant'
        }"
      >
        <p class="whitespace-pre-wrap">{{ message.content }}</p>
        <div class="mt-2 text-xs text-slate-400">{{ message.created_at | date: 'shortTime' }}</div>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBubbleComponent {
  @Input({ required: true }) message!: MessageItem;
}
