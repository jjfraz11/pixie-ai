'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
  AudioTrack,
} from '@livekit/components-react';
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, Track } from 'livekit-client';
import { useAuth } from '../../../contexts/AuthContext';

interface P2PPageProps {
  params: { sessionId: string };
}

export default function P2PPage({ params }: P2PPageProps) {
  const { sessionId } = params;
  const { user, token } = useAuth();
  const router = useRouter();
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) {
      router.push('/'); // Redirect to login if not authenticated
      return;
    }

    const fetchLivekitToken = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/livekit-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            roomName: `p2p-${sessionId}`,
            participantName: user.email,
            participantIdentity: user.id,
            sessionId: sessionId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to get LiveKit token');
        }

        const data = await response.json();
        setLivekitToken(data.token);
        setWsUrl(data.wsUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching LiveKit token');
        console.error('Error fetching LiveKit token:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLivekitToken();
  }, [sessionId, user, token, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-lg">Connecting to session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-900 text-white">
        <div className="text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!livekitToken || !wsUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-lg">Authentication failed or token not available.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <LiveKitRoom
        video={true}
        audio={true}
        token={livekitToken}
        serverUrl={wsUrl}
        connect={true}
        data-lk-theme="default"
        onDisconnected={() => {
          console.log('Disconnected from LiveKit room');
          router.push('/'); // Redirect to home on disconnect
        }}
      >
        <P2PChatUI sessionId={sessionId} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

interface P2PChatUIProps {
  sessionId: string;
}

function P2PChatUI({ sessionId }: P2PChatUIProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const router = useRouter();

  const remoteParticipants = participants.filter(p => p.identity !== localParticipant.identity);

  const handleToggleCamera = async () => {
    if (localParticipant.cameraPublication) {
      await localParticipant.setCameraEnabled(!localParticipant.cameraPublication.track?.isEnabled);
    }
  };

  const handleToggleMicrophone = async () => {
    if (localParticipant.microphonePublication) {
      await localParticipant.setMicrophoneEnabled(!localParticipant.microphonePublication.track?.isEnabled);
    }
  };

  const handleLeaveSession = async () => {
    await room.disconnect();
    router.push('/');
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">P2P Session: {sessionId}</h1>
        <div className="space-x-2">
          <button
            onClick={handleToggleCamera}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            Toggle Camera
          </button>
          <button
            onClick={handleToggleMicrophone}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            Toggle Microphone
          </button>
          <button
            onClick={handleLeaveSession}
            className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white"
          >
            Leave Session
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Local Participant */}
        <div className="bg-gray-800 rounded-lg overflow-hidden relative">
          <VideoConference room={room} />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm">
            {localParticipant.identity} (You)
          </div>
        </div>

        {/* Remote Participants */}
        {remoteParticipants.map((participant) => (
          <div key={participant.identity} className="bg-gray-800 rounded-lg overflow-hidden relative">
            <VideoConference room={room} />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm">
              {participant.identity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}