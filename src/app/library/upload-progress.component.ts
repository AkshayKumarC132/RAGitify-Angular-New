import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-upload-progress',
  standalone: true,
  imports: [NgIf],
  template: `
    <div *ngIf="active" class="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
      <span class="h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent"></span>
      <span>Uploading and ingesting documents…</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadProgressComponent {
  @Input() active = false;
}
