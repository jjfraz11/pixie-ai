import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { axe, toHaveNoViolations } from 'jest-axe'; // Import axe and toHaveNoViolations
import '@testing-library/jest-dom';

import LoginForm from '@/app/components/auth/LoginForm';

// Mock the AuthContext
const mockLogin = jest.fn();
const mockUseAuth = {
  user: null,
  token: null,
  login: mockLogin,
  logout: jest.fn(),
  setShowRegister: jest.fn(),
};

jest.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, // Mock AuthProvider
}));

// Mock fetch
global.fetch = jest.fn();

// Extend Jest with jest-axe matchers (already done in jest.setup.mjs, but good to be explicit)
expect.extend(toHaveNoViolations);

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { email: 'test@example.com' }, accessToken: 'mock-token' }),
    });
  });

  it('should not have any accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders email, password, and captcha fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/captcha/i)).toBeInTheDocument();
  });

  it('allows typing into email, password, and captcha fields', () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const captchaInput = screen.getByLabelText(/captcha/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(captchaInput, { target: { value: 'pixie' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
    expect(captchaInput).toHaveValue('pixie');
  });

  it('calls login on successful submission', async () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const captchaInput = screen.getByLabelText(/captcha/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(captchaInput, { target: { value: 'pixie' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'local',
          email: 'test@example.com',
          password: 'password123',
          captcha: 'pixie',
        }),
      });
      expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com' }, 'mock-token');
    });
  });

  it('displays error message on failed login', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid credentials' }),
    });

    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const captchaInput = screen.getByLabelText(/captcha/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.change(captchaInput, { target: { value: 'pixie' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Error: Invalid credentials')).toBeInTheDocument();
    });
  });

  it('calls setShowRegister when "Create an account" is clicked', () => {
    render(<LoginForm />);
    const createAccountButton = screen.getByRole('button', { name: /create an account/i });
    fireEvent.click(createAccountButton);
    expect(mockUseAuth.setShowRegister).toHaveBeenCalledWith(true);
  });
});
