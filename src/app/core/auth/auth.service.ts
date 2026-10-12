import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, defer, finalize, firstValueFrom, from, map, of, shareReplay, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope, AuthSession, AuthUser } from './auth.models';
import { SessionCoordinator } from './session-coordinator.service';
import { getErrorMessage } from '../http/error-message';

interface CsrfData { token: string; headerName: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly coordinator = inject(SessionCoordinator);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = `${environment.API_URL}/api/v1/auth`;
  private token: string | null = null;
  private generation = 0;
  private refreshInFlight: Observable<ApiEnvelope<AuthSession>> | null = null;
  private bootstrapInFlight: Observable<void> | null = null;
  private logoutPending = false;
  readonly currentUser = signal<AuthUser | null>(null);
  readonly initialized = signal(false);
  readonly restoring = signal(false);
  readonly sessionError = signal('');

  constructor() {
    if (this.browser) {
      // One-time removal of credentials written by the previous application version.
      try {
        for (const key of ['subject-pathway.access', 'subject-pathway.refresh', 'subject-pathway.user']) {
          sessionStorage.removeItem(key);
          localStorage.removeItem(key);
        }
      } catch { /* Storage may be disabled; current authentication never uses it. */ }
    }
    this.coordinator.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.clear();
      if (event === 'changed') {
        this.initialized.set(false);
        this.ensureSession().subscribe();
      }
    });
  }

  login(username: string, password: string): Observable<ApiEnvelope<AuthSession>> {
    return this.signIn('login', username, password);
  }

  register(username: string, password: string): Observable<ApiEnvelope<AuthSession>> {
    return this.signIn('register', username, password);
  }

  private signIn(action: 'login' | 'register', username: string, password: string): Observable<ApiEnvelope<AuthSession>> {
    return defer(() => {
      const generation = ++this.generation;
      return this.cookieOperation<AuthSession>(action, { username, password }, generation).pipe(
        tap(({ data }) => { this.store(data); this.coordinator.notify('changed'); })
      );
    });
  }

  refresh(): Observable<ApiEnvelope<AuthSession>> {
    if (this.logoutPending) return throwError(() => this.cancelled());
    if (!this.refreshInFlight) {
      const generation = this.generation;
      this.refreshInFlight = this.cookieOperation<AuthSession>('refresh', {}, generation).pipe(
        tap(({ data }) => this.store(data)),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401 && generation === this.generation) {
            this.clear();
          }
          return throwError(() => error);
        }),
        finalize(() => { this.refreshInFlight = null; }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.refreshInFlight;
  }

  ensureSession(): Observable<void> {
    if (!this.browser || (this.initialized() && !this.sessionError())) return of(undefined);
    if (!this.bootstrapInFlight) {
      this.restoring.set(true);
      this.sessionError.set('');
      this.bootstrapInFlight = this.refresh().pipe(
        map(() => undefined),
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            this.sessionError.set(getErrorMessage(error, 'Không thể khôi phục phiên. Hãy dùng trình duyệt mới nhất và thử lại.'));
          }
          return of(undefined);
        }),
        finalize(() => {
          this.initialized.set(true);
          this.restoring.set(false);
          this.bootstrapInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.bootstrapInFlight;
  }

  logout(): Observable<void> {
    return defer(() => {
      this.logoutPending = true;
      const generation = ++this.generation;
      return this.cookieOperation<null>('logout', {}, generation).pipe(
        tap(() => { this.clear(); this.coordinator.notify('logout'); }),
        map(() => undefined),
        finalize(() => { this.logoutPending = false; })
      );
    });
  }

  get accessToken(): string | null { return this.token; }
  get user(): AuthUser | null { return this.currentUser(); }
  get isAdmin(): boolean { return this.user?.role === 'ADMIN' || this.user?.role === 'SUPER_ADMIN'; }
  get isSuperAdmin(): boolean { return this.user?.role === 'SUPER_ADMIN'; }

  store(session: AuthSession): void {
    this.token = session.accessToken;
    this.currentUser.set(session.user);
    this.initialized.set(true);
    this.sessionError.set('');
  }

  clear(): void {
    ++this.generation;
    this.token = null;
    this.currentUser.set(null);
    this.initialized.set(true);
    this.sessionError.set('');
  }

  private cookieOperation<T>(action: string, body: object, generation: number): Observable<ApiEnvelope<T>> {
    return defer(() => from(this.coordinator.run(async () => {
      if (generation !== this.generation) throw this.cancelled();
      const csrf = await firstValueFrom(this.http.get<ApiEnvelope<CsrfData>>(`${this.apiUrl}/csrf`, {
        withCredentials: true, transferCache: false, timeout: 10000
      }));
      if (generation !== this.generation) throw this.cancelled();
      const result = await firstValueFrom(this.http.post<ApiEnvelope<T>>(`${this.apiUrl}/${action}`, body, {
        withCredentials: true, transferCache: false, timeout: 10000,
        headers: { 'X-XSRF-TOKEN': csrf.data.token }
      }));
      if (generation !== this.generation) throw this.cancelled();
      return result;
    })));
  }

  private cancelled(): HttpErrorResponse {
    return new HttpErrorResponse({ status: 401, statusText: 'Session changed' });
  }
}
