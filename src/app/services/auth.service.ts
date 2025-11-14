import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, tap } from 'rxjs/operators';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';
import { GlobalState } from '../state/global.state';

const API_BASE = 'https://rag.xamplify.co/rag';
const STORAGE_KEY = 'ragitify_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(GlobalState);
  private readonly router = inject(Router);
  readonly pending = signal(false);

  register(payload: RegisterRequest) {
    this.pending.set(true);
    return this.http.post<AuthResponse>(`${API_BASE}/register/`, payload).pipe(
      tap(response => this.persistSession(response)),
      finalize(() => this.pending.set(false))
    );
  }

  login(payload: LoginRequest) {
    this.pending.set(true);
    return this.http.post<AuthResponse>(`${API_BASE}/login/`, payload).pipe(
      tap(response => this.persistSession(response)),
      finalize(() => this.pending.set(false))
    );
  }

  logout() {
    const token = this.state.sessionToken();
    if (!token) {
      this.clearSession();
      return;
    }
    this.http
      .get<void>(`${API_BASE}/logout/${token}/`)
      .subscribe({
        next: () => this.clearSession(),
        error: () => this.clearSession()
      });
  }

  restoreSession(): void {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AuthResponse;
      this.state.setSession(parsed.token, parsed.user);
    } catch (error) {
      console.error('Failed to parse session', error);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private persistSession(response: AuthResponse): void {
    this.state.setSession(response.token, response.user);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(response));
    this.router.navigateByUrl('/chat');
  }

  clearSession(): void {
    this.state.setSession(null, null);
    sessionStorage.removeItem(STORAGE_KEY);
    this.router.navigateByUrl('/auth');
  }
}
