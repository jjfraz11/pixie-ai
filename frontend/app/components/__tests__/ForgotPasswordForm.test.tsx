import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForgotPasswordForm from '../ForgotPasswordForm';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock the AuthContext
const mockUseAuth = {
  user: null,
  token: null,
  login: jest.fn(),
  logout: jest.fn(),
  setShowRegister: jest.fn(),
  setShowForgotPassword: jest.fn(), // Mock setShowForgotPassword
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, // Mock AuthProvider
}));

// Mock fetch
global.fetch = jest.fn();

describe('ForgotPasswordForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.setShowForgotPassword.mockClear();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'If a matching account is found, a password reset email will be sent.' }),
    });
  });

  it('renders email field and submit button', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('allows typing into email field', () => {
    render(<ForgotPasswordForm />);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('calls API on successful submission', async () => {
    render(<ForgotPasswordForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/authentication/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      expect(screen.getByText('If a matching account is found, a password reset email will be sent.')).toBeInTheDocument();
    });
  });

  it('displays error message on failed submission', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Email not found' }),
    });

    render(<ForgotPasswordForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'nonexistent@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Error: Email not found')).toBeInTheDocument();
    });
  });

  it('calls setShowForgotPassword when "Back to Login" is clicked', () => {
    render(<ForgotPasswordForm />);
    const backToLoginButton = screen.getByRole('button', { name: /back to login/i });
    fireEvent.click(backToLoginButton);
    expect(mockUseAuth.setShowForgotPassword).toHaveBeenCalledWith(false);
  });
});