import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { getErrorMessage } from '../../core/http/error-message';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly registerMode = this.route.snapshot.data['register'] === true;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly passwordVisible = signal(false);

  username = '';
  password = '';
  confirmPassword = '';

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  submit(form: NgForm): void {
    this.error.set('');
    form.control.markAllAsTouched();
    if (form.invalid) return;
    if (this.registerMode && this.password !== this.confirmPassword) {
      this.error.set('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    this.busy.set(true);
    const request = this.registerMode
      ? this.auth.register(this.username.trim(), this.password)
      : this.auth.login(this.username.trim(), this.password);

    request.subscribe({
      next: ({ data }) => {
        this.busy.set(false);
        void this.router.navigate([data.user.role === 'USER' ? '/' : '/admin']);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(getErrorMessage(error, this.registerMode
          ? 'Chưa thể tạo tài khoản. Hãy kiểm tra thông tin và thử lại.'
          : 'Không thể đăng nhập. Hãy kiểm tra thông tin và thử lại.'));
      }
    });
  }
}
