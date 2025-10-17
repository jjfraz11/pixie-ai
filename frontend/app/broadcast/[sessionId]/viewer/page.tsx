"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useAuth } from "@/contexts/AuthContext";
import { getBroadcastSession } from "@/lib/api";

interface ViewerPageProps {
  sessionId: string;
  livekitToken: string;
  roomName: string;
  wsUrl: string;
  title: string;
}

function StreamViewer({ sessionId, livekitToken, roomName, wsUrl, title }: ViewerPageProps) {
  const router = useRouter(); // Ensure useRouter is called within the component body

  const handleLeaveStream = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="relative h-screen">
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

        <div className="pt-16 h-full">
          <LiveKitRoom
            serverUrl={wsUrl}
            token={livekitToken}
            connect={true}
            onDisconnected={() => {
                router.push("/");
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

export default function ViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { token: authToken } = useAuth();
  const sessionId = params.sessionId as string;

  const [sessionData, setSessionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionData = useCallback(async () => {
    if (!authToken) return;
    try {
      setLoading(true);
      setError(null);

      const session = await getBroadcastSession(sessionId, authToken);

      setSessionData(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }, [sessionId, authToken]);

  useEffect(() => {
    if (sessionId && authToken) {
      fetchSessionData();
    }
  }, [sessionId, fetchSessionData, authToken]);

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

  return (
    <StreamViewer
        sessionId={sessionId}
        livekitToken={sessionData.livekitToken}
        roomName={`broadcast-${sessionData.id}`}
        wsUrl={process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'ws://localhost:7880'}
        title={sessionData.title}
    />
  );
}
