'use client';

import { User } from '@/app/types/auth';

// API helper functions for authentication and user management

export interface LoginRequest {
  strategy: 'local';
  email: string;
  password: string;
  captcha?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  roles: string[];
  captcha: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionResponse {
  id: string;
  type: "broadcast" | "p2p";
  title: string;
  hostId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordResetRequest {
  action: 'request';
  email: string;
}

export interface PasswordResetChange {
  action: 'change';
  token: string;
  newPassword: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

/**
 * Login API call
 */
export async function loginAPI(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch('/api/authentication', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  console.info({ loginApiResponse: response });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Login failed');
  }

  return response.json();
}

/**
 * Register API call
 */
export async function registerAPI(data: RegisterRequest): Promise<UserResponse> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Registration failed');
  }

  return response.json();
}

/**
 * Get users API call (for UserList component)
 */
export async function getUsersAPI(token: string): Promise<UserResponse[]> {
  const response = await fetch('/api/users', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch users');
  }

  return response.json();
}

/**
 * Create a broadcast session
 */
export async function goLive(
  token: string,
  title: string
): Promise<SessionResponse> {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: "broadcast",
      title,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to start stream");
  }

  return response.json();
}

/**
 * Password reset request API call
 */
export async function requestPasswordResetAPI(data: PasswordResetRequest): Promise<PasswordResetResponse> {
  const response = await fetch('/api/authentication/password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to request password reset');
  }

  return response.json();
}

/**
 * Change password API call
 */
export async function changePasswordAPI(data: PasswordResetChange): Promise<PasswordResetResponse> {
  const response = await fetch('/api/authentication/password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to change password');
  }

  return response.json();
}

export async function getBroadcastSession(sessionId: string, authToken: string) {
  console.log(`getBroadcastSession function not yet implemented (sessionId: ${sessionId}, authToken: ${authToken})`)
}