import React from 'react';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { loginAPI } from '@/lib/api'

import LoginForm from '../LoginForm';

// Mock the api module
jest.mock("@/lib/api");

const mockApiLogin = loginAPI as jest.Mock;

// Mock Next.js router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock AuthContext
const mockUseAuth = {
  login: jest.fn(),
  setShowRegister: jest.fn(),
  setShowForgotPassword: jest.fn(),
};
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
}));


describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls api login and auth context login on successful submission', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
    const mockToken = 'mock-token';
    mockApiLogin.mockResolvedValue({ user: mockUser, token: mockToken });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockApiLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    await waitFor(() => {
      expect(mockUseAuth.login).toHaveBeenCalledWith(mockUser, mockToken);
    });
  });

  it('displays error when login fails', async () => {
    const errorMessage = 'Invalid credentials';
    mockApiLogin.mockRejectedValue(new Error(errorMessage));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
  });

  it('shows validation error for empty fields', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Check for both validation messages
    const emailError = await screen.findByText('Email is required');
    const passwordError = await screen.findByText('Password is required');

    expect(emailError).toBeInTheDocument();
    expect(passwordError).toBeInTheDocument();
  });

  it('navigates to forgot password page', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByText('Forgot Password?'));
    expect(mockUseAuth.setShowForgotPassword).toHaveBeenCalledWith(true);
  });

  it('navigates to register page', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByText('Sign Up'));
    expect(mockUseAuth.setShowRegister).toHaveBeenCalledWith(true);
  });
});
