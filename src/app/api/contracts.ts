import type { PermissionMap } from './auth-utils';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UserPayload {
  id?: number;
  username: string;
  displayName: string;
  password?: string;
  role: 'admin' | 'user' | string;
  permissions: Partial<PermissionMap>;
  isActive: boolean;
}

export interface ApiErrorResponse {
  error: string;
}

export interface ApiSuccessResponse {
  success: boolean;
}
