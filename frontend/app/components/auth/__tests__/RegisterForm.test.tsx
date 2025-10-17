import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RegisterForm from '../RegisterForm';
import { useAuth } from "@/contexts/AuthContext";

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
};

jest.mock("/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth,
}));

describe("RegisterForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders email, password, confirm password, and captcha fields', () => {
  it("renders form correctly", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/captcha/i)).toBeInTheDocument();
  });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Login" })).toBeInTheDocument();
  });

  it("calls login and setShowRegister on successful registration", async () => {
    const mockUser = { id: "1", email: "newuser@example.com", roles: ["user"] };
    const mockToken = "fake-token";

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ // First fetch for registration
        ok: true,
        json: async () => ({ id: "1", email: "newuser@example.com" }),
      })
      .mockResolvedValueOnce({ // Second fetch for login
        ok: true,
        json: async () => ({ user: mockUser, accessToken: mockToken }),
      });

    render(<RegisterForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const captchaInput = screen.getByLabelText(/captcha/i);

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(captchaInput, { target: { value: 'pixie' } });

    expect(emailInput).toHaveValue('newuser@example.com');
    expect(passwordInput).toHaveValue('newpassword123');
    expect(confirmPasswordInput).toHaveValue('newpassword123');
    expect(captchaInput).toHaveValue('pixie');

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "newuser@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "newpassword123" } });

    const registerButton = screen.getByRole("button", { name: "Register" });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(mockUseAuth.login).toHaveBeenCalledWith(mockUser, mockToken);
      expect(mockUseAuth.setShowRegister).toHaveBeenCalledWith(false);
    });
  });

  it("displays error message on failed registration", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Registration failed" }),
    });

    render(<RegisterForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const captchaInput = screen.getByLabelText(/captcha/i);

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(captchaInput, { target: { value: 'pixie' } });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "newuser@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "newpassword123" } });

    const registerButton = screen.getByRole("button", { name: "Register" });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText("Registration failed")).toBeInTheDocument();
    });
  });

  it("calls setShowRegister when 'Back to Login' is clicked", () => {
    render(<RegisterForm />);
    const backToLoginButton = screen.getByRole("button", { name: "Back to Login" });
    fireEvent.click(backToLoginButton);
    expect(mockUseAuth.setShowRegister).toHaveBeenCalledWith(false);
  });
});

