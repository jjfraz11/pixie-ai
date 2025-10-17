'use client';

import { useCallback, useState, FormEvent } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function LoginForm() {
  const { loginForm, setLoginForm, loginError, handleLogin, setShowRegister } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setLoading(true);
      try {
        await handleLogin(event);
      } finally {
        setLoading(false);
      }
    },
    [handleLogin],
  );

  const handleShowRegister = useCallback(() => {
    setShowRegister(true);
  }, [setShowRegister]);

  return (
    <section className="space-y-6">
      <div className="p-1">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email address
        </label>

        <input
          id="email"
          type="email"
          value={loginForm.email}
          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      <div className="p-1">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={loginForm.password}
          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      <div className="p-1">
        <label htmlFor="captcha" className="block text-sm font-medium text-gray-700">
          CAPTCHA (type &quot;pixie&quot;)
        </label>
        <input
          id="captcha"
          type="text"
          value={loginForm.captcha}
          onChange={(e) => setLoginForm({ ...loginForm, captcha: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
        />
      </div>

      {loginError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{loginError}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        onClick={handleSubmit}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>

      <button
        type="button"
        onClick={handleShowRegister}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
      >
        Create an account
      </button>
    </section>
  );
}
