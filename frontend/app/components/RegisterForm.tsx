'use client';

import { useCallback, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterForm() {
  const { login, setShowRegister } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleRegister = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setRegisterError(null);

      try {
        const response = await fetch('/api/users', {
          // Register via users service
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            captcha,
            roles: ['user'], // Default role for new users
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Registration failed');
        }

        // After successful registration, automatically log in the user
        // This will trigger the login function in AuthContext
        const loginResponse = await fetch('/api/authentication', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            strategy: 'local',
            email,
            password,
          }),
        });

        if (!loginResponse.ok) {
          const errorData = await loginResponse.json();
          throw new Error(errorData.message || 'Automatic login failed after registration');
        }

        const loginData = await loginResponse.json();
        login(loginData.user, loginData.accessToken);
        setShowRegister(false); // Hide registration form and show main content
      } catch (err) {
        setRegisterError(err instanceof Error ? err.message : 'An unknown error occurred during registration');
      }
    },
    [email, password, login, setShowRegister],
  );

  const handleBackToLogin = useCallback(() => {
    setShowRegister(false);
  }, [setShowRegister]);

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div>
        <label htmlFor="register-email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="register-password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:focus:border-blue-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="captcha" className="block text-sm font-medium text-gray-700">
          CAPTCHA (type "pixie")
        </label>
        <input
          id="captcha"
          type="text"
          value={captcha}
          onChange={(e) => setCaptcha(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>
      {registerError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{registerError}</div>}
      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        Register
      </button>
      <button
        type="button"
        onClick={handleBackToLogin}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
      >
        Back to Login
      </button>
    </form>
  );
}
