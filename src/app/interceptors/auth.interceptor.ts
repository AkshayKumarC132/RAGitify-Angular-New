import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { GlobalState } from '../state/global.state';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const state = inject(GlobalState);
  const token = state.sessionToken();
  if (!token || req.url.includes('/login/') || req.url.includes('/register/')) {
    return next(req);
  }
  const cloned = req.clone({
    setHeaders: {
      Authorization: `Token ${token}`
    }
  });
  return next(cloned);
};
