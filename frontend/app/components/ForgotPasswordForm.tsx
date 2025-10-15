"use client";

import { useCallback, useState, FormEvent } from "react";
import { requestPasswordResetAPI } from "../lib/api";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setMessage(null);
      setIsSubmitting(true);

      try {
        const data = await requestPasswordResetAPI({
          action: "request",
          email,
        });

        setMessage(data.message || "Password reset email sent");
        setEmail(""); // Clear the email field on success
      } catch (err) {
        setMessage(
          err instanceof Error
            ? `Error: ${err.message}`
            : "An unknown error occurred"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [email]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          required
          disabled={isSubmitting}
        />
      </div>
      {message && (
        <div
          className={`text-sm p-3 rounded-md ${
            message.startsWith("Error:")
              ? "text-red-600 bg-red-50"
              : "text-green-600 bg-green-50"
          }`}
        >
          {message}
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        }`}
      >
        {isSubmitting ? "Sending..." : "Send Reset Email"}
      </button>
    </form>
  );
}
