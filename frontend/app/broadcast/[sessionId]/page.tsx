'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  ControlBar,
  RoomAudioRenderer,
  useParticipants,
  ParticipantTile,
  useLocalParticipant,
} from '@livekit/components-react';
import { Room, LocalParticipant } from 'livekit-client';
import '@livekit/components-styles';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveKit } from '../../contexts/LiveKitContext';

interface BroadcastRoomProps {
  sessionId: string;
  livekitToken: string;
  roomName: string;
  wsUrl: string;
  title: string;
}

function BroadcastControlBar() {
  const { localParticipant } = useLocalParticipant();
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  const handleToggleCamera = async () => {
    try {
      const newState = !isCameraEnabled;
      await localParticipant.setCameraEnabled(newState);
      setIsCameraEnabled(newState);
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  };

  const handleToggleMicrophone = async () => {
    try {
      const newState = !isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newState);
      setIsMicrophoneEnabled(newState);
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  };

  return (
    <div className="flex items-center space-x-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg">
      <button
        onClick={handleToggleCamera}
        className="flex items-center space-x-2 px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        title={isCameraEnabled ? 'Disable Camera' : 'Enable Camera'}
      >
        <span className="text-lg">{isCameraEnabled ? '📹' : '📷'}</span>
        <span className="text-sm">{isCameraEnabled ? 'On' : 'Off'}</span>
      </button>
      <button
        onClick={handleToggleMicrophone}
        className="flex items-center space-x-2 px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        title={isMicrophoneEnabled ? 'Disable Microphone' : 'Enable Microphone'}
      >
        <span className="text-lg">{isMicrophoneEnabled ? '🎤' : '🔇'}</span>
        <span className="text-sm">{isMicrophoneEnabled ? 'On' : 'Off'}</span>
      </button>
      <button
        className="flex items-center space-x-2 px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        title="Settings (Not Implemented)"
      >
        <span className="text-lg">⚙️</span>
        <span className="text-sm">Settings</span>
      </button>
    </div>
  );
}

function BroadcastView({ sessionId, livekitToken, roomName, wsUrl, title }: BroadcastRoomProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const router = useRouter();

  const handleEndStream = () => {
    // In a real app, you'd call an API to end the session
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="relative h-screen">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-black bg-opacity-50 p-4">
          <div className="flex items-center justify-between text-white">
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              <p className="text-sm text-gray-300">
                {participants.length} viewer
                {participants.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={handleEndStream}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              End Stream
            </button>
          </div>
        </div>

        {/* Main video area */}
        <div className="pt-16 h-full">
          <LiveKitRoom
            serverUrl={wsUrl}
            token={livekitToken}
            connect={true}
            onDisconnected={() => {
              console.log('Disconnected from LiveKit room');

              // Show error notification to viewers about broadcaster disconnection
              // In a real app, this would be more sophisticated with proper error states
              const notification = document.createElement('div');
              notification.className =
                'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50';
              notification.textContent = 'Connection lost. Attempting to reconnect...';
              document.body.appendChild(notification);

              setTimeout(() => {
                document.body.removeChild(notification);
                router.push('/dashboard');
              }, 3000);
            }}
          >
            <div className="h-full flex flex-col">
              {/* Main broadcaster view */}
              <div className="flex-1 relative">
                <VideoConference />
              </div>

              {/* Participants grid for viewers (if needed) */}
              {participants.length > 1 && (
                <div className="absolute bottom-20 right-4 w-64">
                  <div className="bg-black bg-opacity-70 p-3 rounded-lg">
                    <h3 className="text-white text-sm font-medium mb-2">Viewers</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {participants
                        .filter((p) => p.identity !== 'broadcaster-user-id') // Filter out the broadcaster
                        .slice(0, 5) // Show max 5 viewers
                        .map((participant) => (
                          <div key={participant.identity} className="flex items-center space-x-2 text-white text-sm">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>{participant.name || participant.identity}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Control bar */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <BroadcastControlBar />
              </div>
            </div>
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastRoom() {
  const params = useParams();
  const router = useRouter();
  const { user, token: authToken } = useAuth();
  const { room, connectToRoom, disconnectFromRoom, connectionState, error: livekitError } = useLiveKit();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real app, you'd fetch the session data from your backend
      // For demo purposes, we'll use the sessionId to generate mock data
      const mockSessionData = {
        id: sessionId,
        type: 'broadcast',
        title: 'Live Stream',
        livekitToken: 'mock-livekit-token',
        roomName: `broadcast-${sessionId}`,
        wsUrl: 'ws://localhost:7880',
      };

      // setSessionData(mockSessionData);
      await connectToRoom(mockSessionData.livekitToken, mockSessionData.wsUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load broadcast session');
      console.error('Error fetching session data:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, connectToRoom]);

  useEffect(() => {
    if (authToken && sessionId) {
      fetchSessionData();
    }

    return () => {
      disconnectFromRoom();
    };
  }, [authToken, fetchSessionData, sessionId, disconnectFromRoom]);

  if (loading || connectionState === 'connecting') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading broadcast...</p>
        </div>
      </div>
    );
  }

  if (error || livekitError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-red-400 mb-4">Error: {error || livekitError || 'Session not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-red-400 mb-4">Error: Room not available.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <BroadcastView
      sessionId={sessionId}
      livekitToken={''} // Not needed directly by BroadcastView anymore
      roomName={room.name}
      wsUrl={'ws://localhost:7880'}
      title={'Live Stream'} // Get actual title from session data
    />
  );
}
