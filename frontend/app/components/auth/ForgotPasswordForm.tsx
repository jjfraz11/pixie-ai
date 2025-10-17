'use client';

import { useCallback, useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function ForgotPasswordForm() {
  const { forgotPasswordEmail, setForgotPasswordEmail, forgotPasswordMessage, handleForgotPassword, setShowForgotPassword } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setLoading(true);
      try {
        await handleForgotPassword(event);
      } finally {
        setLoading(false);
      }
    },
    [handleForgotPassword],
  );

  const handleCancel = useCallback(() => {
    setShowForgotPassword(false);
  }, [setShowForgotPassword]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={forgotPasswordEmail}
          onChange={(e) => setForgotPasswordEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
          disabled={loading}
        />
      </div>

      {forgotPasswordMessage && (
        <div
          className={`text-sm p-3 rounded-md ${
            forgotPasswordMessage.startsWith('Error:') ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
          }`}
        >
          {forgotPasswordMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        }`}
      >
        {loading ? 'Sending...' : 'Send Reset Email'}
      </button>
      <button
        type="button"
        onClick={handleCancel}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
      >
        Cancel
      </button>
    </form>
  );
}
