import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/admin/login.component').then((m) => m.LoginComponent),
    title: 'Đăng nhập'
  },
  {
    path: 'register',
    loadComponent: () => import('./features/admin/login.component').then((m) => m.LoginComponent),
    data: { register: true },
    title: 'Đăng ký'
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    title: 'Quản trị'
  },
  {
    path: '',
    loadChildren: () => import('./features/search/search.routes').then((m) => m.SEARCH_ROUTES)
  }
];
