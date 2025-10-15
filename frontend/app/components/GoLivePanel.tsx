"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

interface GoLivePanelProps {
  className?: string;
}

export default function GoLivePanel({ className = "" }: GoLivePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuth();
  const router = useRouter();

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, [setIsExpanded]);

  const handleStreamTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStreamTitle(e.target.value);
    },
    [setStreamTitle]
  );

  const handleStartStream = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!streamTitle.trim()) {
      setError("Please enter a stream title");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create a broadcast session
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "broadcast",
          title: streamTitle.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to start stream");
      }

      const session = await response.json();

      // Redirect to the broadcast room
      router.push(`/broadcast/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start stream");
      console.error("Error starting stream:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user has broadcaster role
  const isBroadcaster = user?.roles?.includes("broadcaster");

  if (!isBroadcaster) {
    return null; // Don't render for non-broadcasters
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      <div className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
        >
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="font-medium text-gray-900">Go Live</span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transform transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <form onSubmit={handleStartStream} className="space-y-4">
              <div>
                <label
                  htmlFor="stream-title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Stream Title
                </label>
                <input
                  id="stream-title"
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="Enter your stream title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !streamTitle.trim()}
                className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isLoading || !streamTitle.trim()
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                }`}
              >
                {isLoading ? "Starting Stream..." : "Start Broadcast"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
