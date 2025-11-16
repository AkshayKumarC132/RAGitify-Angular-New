import { inject } from '@angular/core';
import { GlobalState } from '../state/global.state';

export abstract class BaseApiService {
  protected readonly state = inject(GlobalState);

  protected requireToken(): string {
    const token = this.state.sessionToken();
    if (!token) {
      throw new Error('Authentication token missing');
    }
    return token;
  }
}
