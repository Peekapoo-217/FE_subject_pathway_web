import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map(() => {
    if (auth.sessionError()) return false;
    if (auth.isAdmin && auth.accessToken) return true;
    return router.createUrlTree([auth.user ? '/' : '/login']);
  }));
};
