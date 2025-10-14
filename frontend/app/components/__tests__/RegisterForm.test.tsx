import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RegisterForm from '../RegisterForm';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock the AuthContext
const mockLogin = jest.fn();
const mockUseAuth = {
  user: null,
  token: null,
  login: mockLogin,
  logout: jest.fn(),
  setShowRegister: jest.fn(),
  handleRegister: jest.fn(), // Mock handleRegister
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, // Mock AuthProvider
}));

// Mock fetch
global.fetch = jest.fn();

describe('RegisterForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.handleRegister.mockClear(); // Clear mock for handleRegister
  });

  it('renders email and password fields', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('allows typing into email and password fields', () => {
    render(<RegisterForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });

    expect(emailInput).toHaveValue('newuser@example.com');
    expect(passwordInput).toHaveValue('newpassword123');
  });

  it('calls handleRegister on submission', async () => {
    render(<RegisterForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const registerButton = screen.getByRole('button', { name: /register/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(mockUseAuth.handleRegister).toHaveBeenCalledTimes(1);
    });
  });

  it('calls setShowRegister when "Back to Login" is clicked', () => {
    render(<RegisterForm />);
    const backToLoginButton = screen.getByRole('button', { name: /back to login/i });
    fireEvent.click(backToLoginButton);
    expect(mockUseAuth.setShowRegister).toHaveBeenCalledWith(false);
  });
});