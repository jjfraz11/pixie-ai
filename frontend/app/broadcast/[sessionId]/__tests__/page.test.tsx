import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BroadcastPage from '../page'; // Adjust this path as necessary
import { useAuth } from '@/contexts/AuthContext';
import { useRoom, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { getBroadcastSession } from '@/lib/api';

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
  useParams: () => ({ sessionId: 'test-session' }),
}));

// Mock useAuth
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', name: 'Test User' },
    token: 'mock-token',
  }),
}));

// Mock LiveKit hooks
jest.mock('@livekit/components-react', () => ({
    ...jest.requireActual('@livekit/components-react'),
  useRoom: jest.fn(),
  useLocalParticipant: jest.fn(),
  useParticipants: jest.fn(),
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="livekit-room">{children}</div>,
  VideoConference: () => <div data-testid="video-conference" />,
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
}));

jest.mock('@/lib/api', () => ({
    getBroadcastSession: jest.fn(),
}));

describe('BroadcastPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (useRoom as jest.Mock).mockClear();
    (useLocalParticipant as jest.Mock).mockClear();
    (useParticipants as jest.Mock).mockClear();
    (getBroadcastSession as jest.Mock).mockClear();
  });

  it('renders loading state initially', async () => {
    (getBroadcastSession as jest.Mock).mockResolvedValue(new Promise(() => {})); // Never resolves

    render(<BroadcastPage params={{ sessionId: 'test-session' }} />);
    expect(screen.getByText('Connecting to broadcast...')).toBeInTheDocument();
  });

  it('renders broadcast view when session is loaded', async () => {
    const mockSession = {
      id: 'test-session',
      title: 'Test Broadcast',
      livekitToken: 'test-token',
    };
    (getBroadcastSession as jest.Mock).mockResolvedValue(mockSession);
    (useRoom as jest.Mock).mockReturnValue({ isConnecting: false });
    (useLocalParticipant as jest.Mock).mockReturnValue({ localParticipant: { isCameraEnabled: true, isMicrophoneEnabled: true } });
    (useParticipants as jest.Mock).mockReturnValue([]);

    render(<BroadcastPage params={{ sessionId: 'test-session' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Broadcast')).toBeInTheDocument();
    });
  });

  it('renders error state if session loading fails', async () => {
    (getBroadcastSession as jest.Mock).mockRejectedValue(new Error('Failed to load'));

    render(<BroadcastPage params={{ sessionId: 'test-session' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to load/)).toBeInTheDocument();
    });
  });
});
