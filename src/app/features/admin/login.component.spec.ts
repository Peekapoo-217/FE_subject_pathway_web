import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let routeSnapshot: { data: Record<string, unknown> };
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  const session = {
    accessToken: 'access',
    
    tokenType: 'Bearer' as const,
    expiresIn: 900,
    user: { id: 'user-id', username: 'student', role: 'USER' as const }
  };

  beforeEach(async () => {
    routeSnapshot = { data: { register: false } };
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'register']);
    auth.login.and.returnValue(of({ success: true, data: session }));
    auth.register.and.returnValue(of({ success: true, data: session }));

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: routeSnapshot } }
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  async function render(register = false): Promise<HTMLElement> {
    routeSnapshot.data['register'] = register;
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function enter(root: HTMLElement, id: string, value: string): Promise<void> {
    const input = root.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Input #${id} was not rendered`);
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function submit(root: HTMLElement): Promise<void> {
    const form = root.querySelector('form');
    if (!form) throw new Error('Authentication form was not rendered');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the login screen without registration-only fields', async () => {
    const root = await render();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Đăng nhập');
    expect(root.querySelector('#confirm-password')).toBeNull();
    expect(root.textContent).toContain('Chưa có tài khoản?');
  });

  it('submits normalized login credentials and routes USER to the public page', async () => {
    const root = await render();
    await enter(root, 'username', ' student ');
    await enter(root, 'password', 'valid-pass');

    await submit(root);

    expect(auth.login).toHaveBeenCalledWith('student', 'valid-pass');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('renders registration, prevents mismatched passwords, and announces the error', async () => {
    const root = await render(true);
    await enter(root, 'username', 'student');
    await enter(root, 'password', 'strong-pass');
    await enter(root, 'confirm-password', 'different-pass');

    await submit(root);

    expect(auth.register).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('chưa khớp');
    expect(root.querySelector('#confirm-password')?.classList.contains('is-invalid')).toBeTrue();
  });

  it('registers a USER with a six-character password and redirects to the public page', async () => {
    const root = await render(true);
    await enter(root, 'username', ' student ');
    await enter(root, 'password', 'sixsix');
    await enter(root, 'confirm-password', 'sixsix');

    await submit(root);

    expect(auth.register).toHaveBeenCalledWith('student', 'sixsix');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('highlights a five-character registration password and blocks the request', async () => {
    const root = await render(true);
    await enter(root, 'username', 'student');
    await enter(root, 'password', 'five5');
    await enter(root, 'confirm-password', 'five5');

    await submit(root);

    const password = root.querySelector<HTMLInputElement>('#password');
    expect(auth.register).not.toHaveBeenCalled();
    expect(password?.classList.contains('ng-invalid')).toBeTrue();
    expect(password?.classList.contains('ng-touched')).toBeTrue();
    expect(password?.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#password-error')?.textContent).toContain('ít nhất 6 ký tự');
  });

  it('shows the backend validation message when authentication fails', async () => {
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: { success: false, message: 'Thông tin đăng nhập không hợp lệ.' }
    })));
    const root = await render();
    await enter(root, 'username', 'adminsp');
    await enter(root, 'password', 'adminsp');

    await submit(root);

    expect(root.querySelector('[role="alert"]')?.textContent)
      .toContain('Thông tin đăng nhập không hợp lệ.');
  });

  it('toggles password visibility accessibly', async () => {
    const root = await render();
    const input = root.querySelector<HTMLInputElement>('#password');
    const toggle = root.querySelector<HTMLButtonElement>('.password-toggle');
    expect(input).not.toBeNull();
    expect(toggle).not.toBeNull();
    expect(input?.type).toBe('password');

    toggle?.click();
    fixture.detectChanges();

    expect(input?.type).toBe('text');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('Ẩn mật khẩu');
  });
});
