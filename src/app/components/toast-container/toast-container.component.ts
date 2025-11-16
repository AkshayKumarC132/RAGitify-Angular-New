import { AsyncPipe, NgFor, NgIf, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, NgClass],
  template: `
    <div class="fixed top-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
      <div
        *ngFor="let toast of notifications.messages()"
        class="rounded-lg border border-white/10 px-4 py-2 shadow-lg backdrop-blur bg-slate-900/80"
        [ngClass]="{
          'text-emerald-300 border-emerald-500/40': toast.type === 'success',
          'text-red-300 border-red-500/40': toast.type === 'error',
          'text-amber-300 border-amber-500/40': toast.type === 'warning'
        }"
      >
        {{ toast.message }}
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastContainerComponent {
  protected readonly notifications = inject(NotificationService);
}
