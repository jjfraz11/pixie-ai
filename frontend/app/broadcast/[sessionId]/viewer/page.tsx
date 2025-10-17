"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";

interface ViewerPageProps {
  sessionId: string;
  title?: string;
}

function StreamViewer({ sessionId, title }: ViewerPageProps) {
  const router = useRouter();

  const handleLeaveStream = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="relative h-screen">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-black bg-opacity-50 p-4">
          <div className="flex items-center justify-between text-white">
            <div>
              <h1 className="text-xl font-bold">{title || "Live Stream"}</h1>
              <p className="text-sm text-gray-300">Live</p>
              <p className="text-sm text-gray-300">0 viewers</p> {/* Placeholder for actual viewer count */}
            </div>
            <button
              onClick={handleLeaveStream}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Leave Stream
            </button>
          </div>
        </div>

        {/* Video area */}
        <div className="pt-16 h-full">
          <LiveKitRoom
            serverUrl="ws://localhost:7880" // In real app, get from session data
            token={`mock-viewer-token-${sessionId}`} // In real app, generate proper viewer token
            connect={true}
            onDisconnected={() => {
              console.log("Disconnected from stream");

              // Show error notification about broadcaster disconnection
              const notification = document.createElement("div");
              notification.className =
                "fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50";
              notification.textContent = "Stream ended by broadcaster";
              document.body.appendChild(notification);

              setTimeout(() => {
                if (document.body.contains(notification)) {
                  document.body.removeChild(notification);
                }
                router.push("/");
              }, 3000);
            }}
          >
            <div className="h-full">
              <VideoConference />
            </div>
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
}

interface SessionData {
  id: string;
  type: string;
  title: string;
  status: string;
}

export default function ViewerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real app, you'd fetch the session data from your backend
      // For demo purposes, we'll use mock data
      const mockSessionData = {
        id: sessionId,
        type: "broadcast",
        title: "Live Stream",
        status: "active",
      };

      setSessionData(mockSessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stream");
      console.error("Error fetching session data:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId, fetchSessionData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading stream...</p>
        </div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-red-400 mb-4">
            Error: {error || "Stream not found"}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return <StreamViewer sessionId={sessionId} title={sessionData.title} />;
}
