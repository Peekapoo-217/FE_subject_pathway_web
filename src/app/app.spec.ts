import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './core/auth/auth.service';
import { of } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideRouter([])]
    }).compileComponents();
    const auth = TestBed.inject(AuthService);
    auth.clear();
    spyOn(auth, 'ensureSession').and.returnValue(of(undefined));
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows login and registration links when signed out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
    expect(links.some((link) => link.textContent?.trim() === 'Đăng nhập')).toBeTrue();
    expect(links.some((link) => link.textContent?.trim() === 'Đăng ký')).toBeTrue();
  });

  it('shows admin navigation and logout when signed in as an administrator', () => {
    const auth = TestBed.inject(AuthService);
    auth.store({ accessToken: 'access',  tokenType: 'Bearer', expiresIn: 900,
      user: { id: 'user-id', username: 'admin', role: 'ADMIN' } });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a[routerlink="/admin"]')).not.toBeNull();
    expect(root.textContent).toContain('Đăng xuất');
    expect(root.textContent).not.toContain('Đăng ký');
    auth.clear();
  });
});
