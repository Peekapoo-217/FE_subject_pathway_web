import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  it('waits for cookie restoration before deciding access', async () => {
    const restored = new Subject<void>();
    const auth = { ensureSession: () => restored, sessionError: () => '', isAdmin: false, accessToken: null as string | null, user: null };
    const router = { createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({} as UrlTree) };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: AuthService, useValue: auth }, { provide: Router, useValue: router }] });
    const decision = TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>;
    const result = firstValueFrom(decision);
    expect(router.createUrlTree).not.toHaveBeenCalled();
    auth.isAdmin = true;
    auth.accessToken = 'restored';
    restored.next();
    expect(await result).toBeTrue();
  });
});
