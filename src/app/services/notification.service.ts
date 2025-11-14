import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messagesSignal = signal<ToastMessage[]>([]);
  private idCounter = 0;

  readonly messages = this.messagesSignal.asReadonly();

  push(type: ToastMessage['type'], message: string): void {
    const toast: ToastMessage = {
      id: ++this.idCounter,
      type,
      message
    };
    this.messagesSignal.update(list => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), 5000);
  }

  dismiss(id: number): void {
    this.messagesSignal.update(list => list.filter(item => item.id !== id));
  }
}
