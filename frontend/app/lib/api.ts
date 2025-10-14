"use client";

import { User } from "../types/auth";

// API helper functions for authentication and user management

export interface LoginRequest {
  strategy: "local";
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  roles: string[];
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

/**
 * Login API call
 */
export async function loginAPI(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch("/api/authentication", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Login failed");
  }

  return response.json();
}

/**
 * Register API call
 */
export async function registerAPI(
  data: RegisterRequest
): Promise<UserResponse> {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Registration failed");
  }

  return response.json();
}

/**
 * Get users API call (for UserList component)
 */
export async function getUsersAPI(token: string): Promise<UserResponse[]> {
  const response = await fetch("/api/users", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch users");
  }

  return response.json();
}
