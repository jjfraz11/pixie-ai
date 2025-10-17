import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForgotPasswordForm from '../ForgotPasswordForm';
import { useAuth } from '../../../contexts/AuthContext';
import { requestPasswordResetAPI } from '../../../lib/api';

// Mock the api module
jest.mock('../../../lib/api');
const mockRequestPasswordReset = requestPasswordResetAPI as jest.Mock;

// Mock the useAuth context
const mockSetShowForgotPassword = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    setShowForgotPassword: mockSetShowForgotPassword,
  }),
}));

describe('ForgotPasswordForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form correctly', () => {
    render(<ForgotPasswordForm onCancel={()=>{}} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls requestPasswordResetAPI on successful submission', async () => {
    mockRequestPasswordReset.mockResolvedValue({ message: 'Password reset email sent' });
    render(<ForgotPasswordForm onCancel={()=>{}} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('displays success message on successful submission', async () => {
    mockRequestPasswordReset.mockResolvedValue({ message: 'Password reset email sent' });
    render(<ForgotPasswordForm onCancel={()=>{}} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }));

    expect(await screen.findByText('Password reset email sent')).toBeInTheDocument();
  });

  it('displays error message on failed submission', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('User not found'));
    render(<ForgotPasswordForm onCancel={()=>{}} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }));

    expect(await screen.findByText('Error: User not found')).toBeInTheDocument();
  });

  it('calls setShowForgotPassword(false) when cancel button is clicked', () => {
    render(<ForgotPasswordForm onCancel={()=>{}} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockSetShowForgotPassword).toHaveBeenCalledWith(false);
  });

  it('disables submit button while submitting', async () => {
    // Mock a slow response
    mockRequestPasswordReset.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ message: 'Password reset email sent' }), 100))
    );

    render(<ForgotPasswordForm onCancel={()=>{}} />);
    const submitButton = screen.getByRole('button', { name: /send reset email/i });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Sending...')).toBeInTheDocument();

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });
});
