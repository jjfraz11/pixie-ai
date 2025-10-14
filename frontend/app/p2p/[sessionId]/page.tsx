'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  ControlBar,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '../../contexts/AuthContext';

interface LiveKitTokenData {
  token: string;
  wsUrl: string;
  participantName: string;
  participantIdentity: string;
}

export default function P2PChatRoom() {
  const params = useParams();
  const router = useRouter();
  const { user, token: authToken } = useAuth();
  const sessionId = params.sessionId as string;

  const [liveKitToken, setLiveKitToken] = useState<LiveKitTokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveKitToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real app, you'd get the room name from the session data
      // For this demo, we'll use the sessionId as the room name
      const roomName = `p2p-${sessionId}`;

      const response = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          roomName,
          participantName: user?.name || 'Anonymous User',
          participantIdentity: user?.id || 'anonymous',
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get LiveKit token');
      }

      const tokenData = await response.json();
      setLiveKitToken(tokenData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to video chat');
      console.error('Error fetching LiveKit token:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, sessionId, user?.name, user?.id]);

  useEffect(() => {
    if (authToken && sessionId) {
      fetchLiveKitToken();
    }
  }, [authToken, sessionId, fetchLiveKitToken]);

  const handleLeaveRoom = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Connecting to video chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <div className="space-x-4">
            <button
              onClick={fetchLiveKitToken}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!liveKitToken) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p>Failed to get video chat token</p>
          <button
            onClick={handleLeaveRoom}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <LiveKitRoom
        serverUrl={liveKitToken.wsUrl}
        token={liveKitToken.token}
        connect={true}
        onDisconnected={() => {
          console.log('Disconnected from LiveKit room');
          router.push('/dashboard');
        }}
      >
        <div className="relative h-screen">
          <VideoConference />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <ControlBar />
          </div>
        </div>
        <RoomAudioRenderer />
      </LiveKitRoom>

      {/* Custom leave button */}
      <button
        onClick={handleLeaveRoom}
        className="absolute top-4 right-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 z-50"
      >
        Leave Room
      </button>
    </div>
  );
}
