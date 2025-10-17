"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { Room, RoomEvent, ConnectionState } from "livekit-client";
import { useAuth } from "./AuthContext";

interface LiveKitContextType {
  room: Room | null;
  connectToRoom: (token: string, url: string) => Promise<void>;
  disconnectFromRoom: () => void;
  connectionState: ConnectionState;
  error: string | null;
}

const LiveKitContext = createContext<LiveKitContextType | undefined>(undefined);

export const LiveKitProvider = ({ children }: { children: ReactNode }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const connectToRoom = useCallback(async (token: string, url: string) => {
    setError(null);
    setConnectionState(ConnectionState.Connecting);

    const newRoom = new Room();

    newRoom
      .on(RoomEvent.Disconnected, () => {
        setConnectionState(ConnectionState.Disconnected);
        setRoom(null);
      })
      .on(RoomEvent.Connected, () => {
        setConnectionState(ConnectionState.Connected);
      })
      .on(RoomEvent.Reconnecting, () => {
        setConnectionState(ConnectionState.Reconnecting);
      })
      .on(RoomEvent.Reconnected, () => {
        setConnectionState(ConnectionState.Connected);
      })
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(state);
      })
      .on(RoomEvent.MediaDevicesError, (e) => {
        setError(`Media device error: ${e.message}`);
      })
      .on(RoomEvent.TrackPublished, (pub, participant) => {
        console.log(`Track published by ${participant.identity}: ${pub.trackSid}`);
      })
      .on(RoomEvent.TrackUnpublished, (pub, participant) => {
        console.log(`Track unpublished by ${participant.identity}: ${pub.trackSid}`);
      });

    try {
      await newRoom.connect(url, token);
      setRoom(newRoom);
    } catch (e: any) {
      setError(e.message || "Failed to connect to LiveKit room");
      setConnectionState(ConnectionState.Disconnected);
      setRoom(null);
    }
  }, []);

  const disconnectFromRoom = useCallback(() => {
    if (room) {
      room.disconnect();
    }
  }, [room]);

  // Clean up room on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return (
    <LiveKitContext.Provider
      value={{
        room,
        connectToRoom,
        disconnectFromRoom,
        connectionState,
        error,
      }}
    >
      {children}
    </LiveKitContext.Provider>
  );
};

export const useLiveKit = () => {
  const context = useContext(LiveKitContext);
  if (context === undefined) {
    throw new Error("useLiveKit must be used within a LiveKitProvider");
  }
  return context;
};
