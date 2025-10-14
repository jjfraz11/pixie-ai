import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Page from '../page';
import { useAuth } from '../../../contexts/AuthContext';
import { useRoom, useLocalParticipant, useParticipants, useTracks } from '@livekit/components-react';

// Mock Next.js useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
  }),
}));

// Mock useAuth
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user1', email: 'user1@example.com' },
    token: 'mock-auth-token',
    login: jest.fn(),
    logout: jest.fn(),
    setShowRegister: jest.fn(),
    setShowForgotPassword: jest.fn(),
  }),
}));

// Mock LiveKit hooks
jest.mock('@livekit/components-react', () => ({
  useRoom: jest.fn(),
  useLocalParticipant: jest.fn(),
  useParticipants: jest.fn(),
  useTracks: jest.fn(),
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
  VideoTrack: ({ trackRef }: any) => <video data-testid="video-track" />,
  AudioTrack: ({ trackRef }: any) => <audio data-testid="audio-track" />,
}));

// Mock fetch
global.fetch = jest.fn();

describe('P2P Chat Room Page', () => {
  const mockRoom = {
    name: 'test-room',
    localParticipant: {
      identity: 'user1',
      isCameraEnabled: true,
      isMicrophoneEnabled: true,
      setCameraEnabled: jest.fn(),
      setMicrophoneEnabled: jest.fn(),
    },
    disconnect: jest.fn(),
  };

  const mockLocalParticipant = {
    cameraPublication: { track: { isEnabled: true } },
    microphonePublication: { track: { isEnabled: true } },
    setCameraEnabled: jest.fn(),
    setMicrophoneEnabled: jest.fn(),
  };

  const mockRemoteParticipant = {
    identity: 'user2',
    isCameraEnabled: true,
    isMicrophoneEnabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRoom as jest.Mock).mockReturnValue(mockRoom);
    (useLocalParticipant as jest.Mock).mockReturnValue(mockLocalParticipant);
    (useParticipants as jest.Mock).mockReturnValue([mockLocalParticipant, mockRemoteParticipant]);
    (useTracks as jest.Mock).mockReturnValue([]); // No tracks by default

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'mock-livekit-token', wsUrl: 'ws://localhost:7880' }),
    });
  });

  it('renders loading state initially', () => {
    (useRoom as jest.Mock).mockReturnValue({ ...mockRoom, isConnecting: true });
    render(<Page params={{ sessionId: 'test-session' }} />);
    expect(screen.getByText(/connecting to session/i)).toBeInTheDocument();
  });

  it('renders P2P controls and participants', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);

    await waitFor(() => {
      expect(screen.getByText(/p2p session: test-session/i)).toBeInTheDocument();
      expect(screen.getByText(/user1/i)).toBeInTheDocument(); // Local participant
      expect(screen.getByText(/user2/i)).toBeInTheDocument(); // Remote participant
      expect(screen.getByRole('button', { name: /toggle camera/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /toggle microphone/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /leave session/i })).toBeInTheDocument();
    });
  });

  it('toggles camera on button click', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);
    const toggleCameraButton = screen.getByRole('button', { name: /toggle camera/i });

    fireEvent.click(toggleCameraButton);
    expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(false);

    (mockLocalParticipant.cameraPublication.track as any).isEnabled = false; // Simulate camera off
    fireEvent.click(toggleCameraButton);
    expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
  });

  it('toggles microphone on button click', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);
    const toggleMicrophoneButton = screen.getByRole('button', { name: /toggle microphone/i });

    fireEvent.click(toggleMicrophoneButton);
    expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);

    (mockLocalParticipant.microphonePublication.track as any).isEnabled = false; // Simulate mic off
    fireEvent.click(toggleMicrophoneButton);
    expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  });

  it('leaves session on button click', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);
    const leaveSessionButton = screen.getByRole('button', { name: /leave session/i });

    fireEvent.click(leaveSessionButton);
    expect(mockRoom.disconnect).toHaveBeenCalledTimes(1);
  });
});