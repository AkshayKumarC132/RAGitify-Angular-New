import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GlobalState } from '../state/global.state';

export const guestGuard: CanActivateFn = () => {
  const state = inject(GlobalState);
  if (!state.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/chat']);
};
