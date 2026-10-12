import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { SessionCoordinator } from './session-coordinator.service';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;
  const api = `${environment.API_URL}/api/v1/admin/users`;
  const session = { accessToken: 'new-access', tokenType: 'Bearer' as const, expiresIn: 900,
    user: { id: 'id', username: 'adminsp', role: 'SUPER_ADMIN' as const } };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
        { provide: SessionCoordinator, useValue: {
          events: new Subject(), run: <T>(operation: () => Promise<T>) => operation(), notify: () => undefined
        } }]
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    auth.store({ ...session, accessToken: 'old-access' });
  });

  afterEach(() => { http.verify(); });

  async function refresh(): Promise<void> {
    http.expectOne((request) => request.url.endsWith('/auth/csrf'))
      .flush({ success: true, data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } });
    await Promise.resolve();
    const request = http.expectOne((item) => item.url.endsWith('/auth/refresh'));
    expect(request.request.body).toEqual({});
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ success: true, data: session });
    // The coordinator uses promises so wait until the retry subscriber has received the token.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  it('refreshes once for simultaneous 401 responses and retries each request', async () => {
    const first = firstValueFrom(client.get(api));
    const second = firstValueFrom(client.get(api + '?page=2'));
    for (const url of [api, api + '?page=2']) {
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer old-access');
      request.flush({}, { status: 401, statusText: 'Unauthorized' });
    }
    await refresh();
    for (const url of [api, api + '?page=2']) {
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer new-access');
      request.flush({ success: true, data: [] });
    }
    await Promise.all([first, second]);
  });

  it('does not clear session when the retried business request returns 500', async () => {
    const result = firstValueFrom(client.get(api)).catch((error: unknown) => error);
    http.expectOne(api).flush({}, { status: 401, statusText: 'Unauthorized' });
    await refresh();
    http.expectOne(api).flush({}, { status: 500, statusText: 'Internal Server Error' });
    await result;
    expect(auth.accessToken).toBe('new-access');
  });

  it('does not leak bearer tokens to RAG, third parties or a similar hostname', async () => {
    for (const url of ['http://localhost:8000/api/chat', 'https://other.example/api/v1/admin/users',
      'https://localhost.evil.example/api/v1/admin/users']) {
      const result = firstValueFrom(client.get(url));
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      expect(request.request.withCredentials).toBeFalse();
      request.flush({});
      await result;
    }
  });

  it('does not refresh for login failure or forbidden requests', async () => {
    for (const [url, status] of [[`${environment.API_URL}/api/v1/auth/login`, 401], [api, 403]] as const) {
      const result = firstValueFrom(client.post(url, {})).catch((error: unknown) => error);
      http.expectOne(url).flush({}, { status, statusText: 'Rejected' });
      await result;
    }
    expect(auth.accessToken).toBe('old-access');
  });

  it('does not retry indefinitely when the new access token is rejected', async () => {
    const result = firstValueFrom(client.get(api)).catch((error: unknown) => error);
    http.expectOne(api).flush({}, { status: 401, statusText: 'Unauthorized' });
    await refresh();
    http.expectOne(api).flush({}, { status: 401, statusText: 'Unauthorized' });
    await result;
    http.expectNone((request) => request.url.endsWith('/auth/refresh'));
  });
});
