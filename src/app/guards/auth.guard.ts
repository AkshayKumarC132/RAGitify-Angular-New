import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GlobalState } from '../state/global.state';

export const authGuard: CanActivateFn = () => {
  const state = inject(GlobalState);
  const router = inject(Router);
  const isAuthenticated = state.isAuthenticated();
  if (!isAuthenticated) {
    router.navigateByUrl('/auth');
  }
  return isAuthenticated;
};
