export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}
