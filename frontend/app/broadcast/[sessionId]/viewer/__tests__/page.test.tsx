import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ViewerPage from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom } from '@livekit/components-react';
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
    user: { id: 'viewer-user-id', name: 'Test Viewer' },
    token: 'mock-auth-token',
  }),
}));

// Mock LiveKit hooks
jest.mock('@livekit/components-react', () => ({
  useRoom: jest.fn(),
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
  VideoConference: () => <div data-testid="video-conference" />,
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="livekit-room">{children}</div>,
}));

jest.mock('@/lib/api', () => ({
    getBroadcastSession: jest.fn(),
}));

describe('ViewerPage', () => {
  it('renders loading state initially, then stream content', async () => {
    (getBroadcastSession as jest.Mock).mockResolvedValue(new Promise(() => {})); // Never resolves

    render(<ViewerPage />);

    await waitFor(() => {
        expect(screen.getByText('Loading stream...')).toBeInTheDocument();
    });
  });

  it('renders stream content when connected', async () => {
    const mockSessionData = {
        id: 'test-session',
        title: 'Test Stream',
        livekitToken: 'mock-livekit-token',
    };
    (getBroadcastSession as jest.Mock).mockResolvedValue(mockSessionData);

    (useRoom as jest.Mock).mockReturnValue({ isConnecting: false });
    render(<ViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Stream')).toBeInTheDocument();
    });
  });
});
