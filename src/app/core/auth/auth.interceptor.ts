import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const base = new URL(environment.API_URL || '/', document.baseURI);
  const url = new URL(request.url, document.baseURI);
  const apiPath = `${base.pathname.replace(/\/$/, '')}/api/v1/`;
  if (url.origin !== base.origin || !url.pathname.startsWith(apiPath)) return next(request);

  const auth = inject(AuthService);
  const cookieAuth = url.pathname.startsWith(`${apiPath}auth/`) && !url.pathname.endsWith('/me');
  const token = auth.accessToken;
  const authorized = token && !cookieAuth
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(authorized).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || cookieAuth || !token) {
      return throwError(() => error);
    }
    // A different request may already have refreshed this tab's access token.
    const current = auth.accessToken;
    if (current && current !== token) {
      return next(request.clone({ setHeaders: { Authorization: `Bearer ${current}` } }));
    }
    return auth.refresh().pipe(
      switchMap(({ data }) => next(request.clone({ setHeaders: { Authorization: `Bearer ${data.accessToken}` } })))
    );
  }));
};
