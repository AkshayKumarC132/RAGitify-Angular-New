import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RunStatus } from '../models/run.model';

@Component({
  selector: 'app-run-status-indicator',
  standalone: true,
  imports: [NgIf],
  template: `
    <div *ngIf="status" class="flex items-center gap-2 text-xs text-slate-400">
      <span class="h-2 w-2 animate-pulse rounded-full bg-primary"></span>
      <span>{{ message }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RunStatusIndicatorComponent {
  @Input() status: RunStatus | null = null;

  get message(): string {
    switch (this.status) {
      case 'queued':
        return 'Queued';
      case 'in_progress':
        return 'Generating response…';
      case 'requires_action':
        return 'Action required';
      case 'failed':
        return 'Run failed';
      case 'cancelled':
        return 'Run cancelled';
      default:
        return 'Idle';
    }
  }
}
