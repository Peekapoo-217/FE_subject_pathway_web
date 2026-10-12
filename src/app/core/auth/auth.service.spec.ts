import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { AuthSession } from './auth.models';
import { AuthService } from './auth.service';
import { SessionCoordinator, SessionEvent } from './session-coordinator.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let events: Subject<SessionEvent>;
  const session: AuthSession = { accessToken: 'access', tokenType: 'Bearer', expiresIn: 900,
    user: { id: 'user-1', username: 'adminsp', role: 'SUPER_ADMIN' } };

  beforeEach(() => {
    events = new Subject<SessionEvent>();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
        { provide: SessionCoordinator, useValue: {
          events, run: <T>(operation: () => Promise<T>) => operation(), notify: jasmine.createSpy('notify')
        } }]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); });

  async function csrf(): Promise<void> {
    const request = http.expectOne((item) => item.url.endsWith('/auth/csrf'));
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ success: true, data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } });
    await Promise.resolve();
  }

  it('posts credentials with CSRF and keeps only access token in memory', async () => {
    const response = firstValueFrom(service.login('adminsp', 'sixsix'));
    await csrf();
    const request = http.expectOne((item) => item.url.endsWith('/auth/login'));
    expect(request.request.body).toEqual({ username: 'adminsp', password: 'sixsix' });
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('csrf');
    request.flush({ success: true, data: session });
    expect((await response).data.user.role).toBe('SUPER_ADMIN');
    expect(service.accessToken).toBe('access');
    expect(sessionStorage.getItem('subject-pathway.access')).toBeNull();
    expect(sessionStorage.getItem('subject-pathway.refresh')).toBeNull();
    expect(localStorage.getItem('subject-pathway.access')).toBeNull();
  });

  it('restores a page reload using cookie without a refresh token body', async () => {
    const result = firstValueFrom(service.ensureSession());
    expect(service.restoring()).toBeTrue();
    await csrf();
    const request = http.expectOne((item) => item.url.endsWith('/auth/refresh'));
    expect(request.request.body).toEqual({});
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ success: true, data: session });
    await result;
    expect(service.isSuperAdmin).toBeTrue();
    expect(service.initialized()).toBeTrue();
    expect(service.restoring()).toBeFalse();
  });

  it('shares one refresh between concurrent callers', async () => {
    const first = firstValueFrom(service.refresh());
    const second = firstValueFrom(service.refresh());
    await csrf();
    http.expectOne((item) => item.url.endsWith('/auth/refresh')).flush({ success: true, data: session });
    await Promise.all([first, second]);
    expect(service.accessToken).toBe('access');
  });

  it('treats missing/expired cookie as signed out without an error banner', async () => {
    const result = firstValueFrom(service.ensureSession());
    await csrf();
    http.expectOne((item) => item.url.endsWith('/auth/refresh')).flush({}, { status: 401, statusText: 'Unauthorized' });
    await result;
    expect(service.user).toBeNull();
    expect(service.sessionError()).toBe('');
    expect(service.initialized()).toBeTrue();
  });

  it('preserves current state when logout fails so the user can retry', async () => {
    service.store(session);
    const result = firstValueFrom(service.logout()).catch((error: unknown) => error);
    await csrf();
    http.expectOne((item) => item.url.endsWith('/auth/logout')).flush({}, { status: 503, statusText: 'Unavailable' });
    await result;
    expect(service.accessToken).toBe('access');
    const retry = firstValueFrom(service.logout());
    await csrf();
    http.expectOne((item) => item.url.endsWith('/auth/logout')).flush({ success: true, data: null });
    await retry;
    expect(service.user).toBeNull();
  });

  it('does not resurrect the session from a refresh response after another tab logs out', async () => {
    service.store(session);
    const result = firstValueFrom(service.refresh()).catch((error: unknown) => error);
    await csrf();
    const request = http.expectOne((item) => item.url.endsWith('/auth/refresh'));
    events.next('logout');
    request.flush({ success: true, data: session });
    await result;
    expect(service.accessToken).toBeNull();
    expect(service.user).toBeNull();
  });

  it('keeps an existing access token on a temporary refresh failure', async () => {
    service.store(session);
    const result = firstValueFrom(service.refresh()).catch((error: unknown) => error);
    await csrf();
    http.expectOne((item) => item.url.endsWith('/auth/refresh')).flush({}, { status: 503, statusText: 'Unavailable' });
    await result;
    expect(service.accessToken).toBe('access');
  });

  it('shows a retryable bootstrap error after network failure', async () => {
    const result = firstValueFrom(service.ensureSession());
    http.expectOne((item) => item.url.endsWith('/auth/csrf')).error(new ProgressEvent('error'));
    await result;
    expect(service.sessionError()).not.toBe('');
    expect(service.restoring()).toBeFalse();
  });
});
