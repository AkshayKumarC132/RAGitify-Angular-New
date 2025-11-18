import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { AuthResponse, LoginRequest, ProtectedUserResponse, RegisterRequest } from '../models/auth.model';
import { GlobalState } from '../state/global.state';
import { buildPublicUrl, buildTokenUrl } from '../utils/api-url';
import { WorkspaceService } from './workspace.service';

const STORAGE_KEY = 'ragitify_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(GlobalState);
  private readonly router = inject(Router);
  private readonly workspace = inject(WorkspaceService);
  readonly pending = signal(false);

  register(payload: RegisterRequest): Observable<AuthResponse> {
    this.pending.set(true);
    return this.http.post<AuthResponse>(buildPublicUrl('register'), payload).pipe(
      tap(response => this.persistSession(response)),
      finalize(() => this.pending.set(false))
    );
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    this.pending.set(true);
    return this.http.post<AuthResponse>(buildPublicUrl('login'), payload).pipe(
      tap(response => this.persistSession(response)),
      finalize(() => this.pending.set(false))
    );
  }

  logout(): void {
    const token = this.state.sessionToken();
    if (!token) {
      this.clearSession();
      return;
    }
    this.http.post<void>(buildTokenUrl('logout', token), {}).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  fetchProtected(): Observable<ProtectedUserResponse> {
    const token = this.state.sessionToken();
    if (!token) {
      throw new Error('Authentication token missing');
    }
    return this.http.get<ProtectedUserResponse>(buildTokenUrl('protected', token));
  }

  restoreSession(): boolean {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    try {
      const parsed = JSON.parse(raw) as AuthResponse;
      this.state.setSession(parsed.token, parsed.user);
      this.state.resetWorkspace();
      this.workspace.reset();
      this.workspace
        .bootstrap()
        .pipe(
          catchError(error => {
            console.error('Failed to bootstrap workspace from stored session', error);
            return of(void 0);
          })
        )
        .subscribe();
      return true;
    } catch (error) {
      console.error('Failed to parse session', error);
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }

  private persistSession(response: AuthResponse): void {
    this.state.resetWorkspace();
    this.workspace.reset();
    this.state.setSession(response.token, response.user);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(response));
    this.workspace
      .bootstrap()
      .pipe(
        catchError(error => {
          console.error('Workspace bootstrap failed after authentication', error);
          return of(void 0);
        })
      )
      .subscribe(() => {
        this.router.navigateByUrl('/chat');
      });
  }

  clearSession(): void {
    this.state.setSession(null, null);
    this.state.resetWorkspace();
    this.workspace.reset();
    sessionStorage.removeItem(STORAGE_KEY);
    this.router.navigateByUrl('/auth');
  }
}
