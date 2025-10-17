'use client';

import { useCallback, useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterForm() {
  const { registerForm, setRegisterForm, registerError, handleRegister, setShowRegister } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setLoading(true);
      try {
        await handleRegister(event);
      } finally {
        setLoading(false);
      }
    },
    [handleRegister],
  );

  const handleBackToLogin = useCallback(() => {
    setShowRegister(false);
  }, [setShowRegister]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="register-email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          id="register-email"
          type="email"
          value={registerForm.email}
          onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
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
          value={registerForm.password}
          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:focus:border-blue-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700">
          Confirm Password
        </label>
        <input
          id="register-confirm-password"
          type="password"
          value={registerForm.confirmPassword}
          onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="captcha" className="block text-sm font-medium text-gray-700">
          CAPTCHA (type &quot;pixie&quot;)
        </label>
        <input
          id="captcha"
          type="text"
          value={registerForm.captcha}
          onChange={(e) => setRegisterForm({ ...registerForm, captcha: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>
      {registerError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{registerError}</div>}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        {loading ? 'Registering...' : 'Register'}
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
