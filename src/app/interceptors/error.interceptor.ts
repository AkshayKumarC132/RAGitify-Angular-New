import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifier = inject(NotificationService);
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          auth.clearSession();
          notifier.push('error', 'Session expired. Please log in again.');
        } else if (err.status === 429) {
          notifier.push('warning', 'Too many requests, wait a moment.');
        } else {
          notifier.push('error', 'Network error — retry?');
        }
      }
      return throwError(() => err);
    })
  );
};
