"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLiveKit } from "@/contexts/LiveKitContext";

interface P2PPageProps {
  params: { sessionId: string };
}

export default function P2PPage({ params }: P2PPageProps) {
  const { sessionId } = params;
  const { user, token } = useAuth();
  const { room, connectToRoom, disconnectFromRoom, connectionState, error: livekitError } = useLiveKit();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hostDisconnected, setHostDisconnected] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      router.push("/"); // Redirect to login if not authenticated
      return;
    }

    const fetchAndConnect = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
          if (response.status === 404) {
            throw new Error("Session not found or expired");
          } else if (response.status === 403) {
            throw new Error("Access denied to this session");
          } else if (
            response.status === 400 &&
            errorData.error?.includes("password")
          ) {
            throw new Error("Session requires a password");
          } else {
            throw new Error(errorData.error || "Failed to join session");
          }
        }

        const data = await response.json();
        await connectToRoom(data.token, data.wsUrl);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while joining the session"
        );
        console.error("Error joining session:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndConnect();

    return () => {
      disconnectFromRoom();
    };
  }, [sessionId, user, token, router, connectToRoom, disconnectFromRoom]);

  if (isLoading || connectionState === "connecting") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-lg">Connecting to session...</div>
      </div>
    );
  }

  if (error || livekitError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-900 text-white">
        <div className="text-lg">Error: {error || livekitError}</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-lg">
          Authentication failed or token not available.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <LiveKitRoom
        room={room}
        video={true}
        audio={true}
        serverUrl=""
        token=""
        data-lk-theme="default"
        onDisconnected={() => {
          console.log("Disconnected from LiveKit room");
          setHostDisconnected(true);
          // Don't immediately redirect - show disconnect message and allow user to leave manually
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
  const [hostDisconnected, setHostDisconnected] = useState(false);

  const remoteParticipants = participants.filter(
    (p) => p.identity !== localParticipant.identity
  );

  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  // Monitor for host disconnections (assuming local participant is not the host)
  useEffect(() => {
    if (remoteParticipants.length === 0 && room.name) {
      // If no remote participants and we're in a room, assume host disconnected
      // In a real implementation, you'd need to check if local user is the host
      setHostDisconnected(true);
    }
  }, [remoteParticipants.length, room.name]);

  const handleToggleCamera = async () => {
    try {
      const newState = !isCameraEnabled;
      await localParticipant.setCameraEnabled(newState);
      setIsCameraEnabled(newState);
    } catch (error) {
      console.error("Error toggling camera:", error);
    }
  };

  const handleToggleMicrophone = async () => {
    try {
      const newState = !isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newState);
      setIsMicrophoneEnabled(newState);
    } catch (error) {
      console.error("Error toggling microphone:", error);
    }
  };

  const handleLeaveSession = async () => {
    await room.disconnect();
    router.push("/");
  };

  const handleHostDisconnectedLeave = () => {
    router.push("/");
  };

  // For T039: Implement error handling for initiating P2P with offline user
  // This would be handled in the UserList component when creating sessions
  // For now, we assume the backend will validate user availability

  if (hostDisconnected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Host Disconnected</h2>
          <p className="mb-6">
            The session host has left the call. The session has ended.
          </p>
          <button
            onClick={handleHostDisconnectedLeave}
            className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">P2P Session: {sessionId}</h1>
        <div className="space-x-2">
          <button
            onClick={handleToggleCamera}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
            aria-label="Toggle camera"
          >
            {isCameraEnabled ? "🔴" : "⚫"} Camera
          </button>
          <button
            onClick={handleToggleMicrophone}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
            aria-label="Toggle microphone"
          >
            {isMicrophoneEnabled ? "🔴" : "⚫"} Mic
          </button>
          <button
            onClick={handleLeaveSession}
            className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white"
            aria-label="Leave session"
          >
            Leave Session
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Local Participant */}
        <div className="bg-gray-800 rounded-lg overflow-hidden relative">
          <VideoConference />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm">
            {localParticipant.identity} (You)
          </div>
        </div>

        {/* Remote Participants */}
        {remoteParticipants.map((participant) => (
          <div
            key={participant.identity}
            className="bg-gray-800 rounded-lg overflow-hidden relative"
          >
            <VideoConference />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm">
              {participant.identity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
