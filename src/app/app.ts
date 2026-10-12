import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { getErrorMessage } from './core/http/error-message';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly appTitle = 'Hướng nghiệp Đại học';
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly signingOut = signal(false);
  protected readonly logoutError = signal('');

  constructor() {
    afterNextRender(() => this.restoreSession());
    effect(() => {
      if (this.auth.initialized() && !this.auth.restoring() && !this.auth.currentUser()
          && !this.auth.sessionError() && this.router.url.startsWith('/admin')) {
        void this.router.navigateByUrl('/login');
      }
    });
  }

  protected restoreSession(): void {
    this.auth.ensureSession().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected signOut(): void {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.logoutError.set('');
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.signingOut.set(false); void this.router.navigateByUrl('/'); },
      error: (error: unknown) => {
        this.signingOut.set(false);
        this.logoutError.set(getErrorMessage(error, 'Chưa thể đăng xuất. Vui lòng thử lại.'));
      }
    });
  }
}
