import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import P2PChatRoom from '../page';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-session-id' }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock AuthContext
const mockUseAuth = {
  user: { id: 'test-user-id', name: 'Test User' },
  token: 'mock-auth-token',
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
}));

// Mock LiveKit components
jest.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="livekit-room">{children}</div>
  ),
  VideoConference: () => <div data-testid="video-conference">Video Conference</div>,
  ControlBar: () => <div data-testid="control-bar">Control Bar</div>,
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer">Audio Renderer</div>,
}));

// Mock fetch
global.fetch = jest.fn();

describe('P2PChatRoom Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'mock-livekit-token',
        wsUrl: 'ws://localhost:7880',
        participantName: 'Test User',
        participantIdentity: 'test-user-id',
      }),
    });
  });

  it('renders loading state initially', () => {
    render(<P2PChatRoom />);

    expect(screen.getByText('Connecting to video chat...')).toBeInTheDocument();
    expect(screen.getByRole('generic', { hidden: true })).toHaveClass('animate-spin');
  });

  it('fetches LiveKit token and renders video conference', async () => {
    render(<P2PChatRoom />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/livekit-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-auth-token',
        },
        body: JSON.stringify({
          roomName: 'p2p-test-session-id',
          participantName: 'Test User',
          participantIdentity: 'test-user-id',
          sessionId: 'test-session-id',
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
      expect(screen.getByTestId('video-conference')).toBeInTheDocument();
      expect(screen.getByTestId('control-bar')).toBeInTheDocument();
      expect(screen.getByTestId('room-audio-renderer')).toBeInTheDocument();
    });
  });

  it('displays error when token fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch token'));

    render(<P2PChatRoom />);

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to fetch token')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Leave Room')).toBeInTheDocument();
    });
  });

  it('retries token fetch when retry button is clicked', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Failed to fetch token'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'mock-livekit-token',
          wsUrl: 'ws://localhost:7880',
          participantName: 'Test User',
          participantIdentity: 'test-user-id',
        }),
      });

    render(<P2PChatRoom />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('navigates to dashboard when leave room is clicked', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch token'));

    render(<P2PChatRoom />);

    await waitFor(() => {
      expect(screen.getByText('Leave Room')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Leave Room'));

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('displays fallback message when no LiveKit token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => null, // No token returned
    });

    render(<P2PChatRoom />);

    await waitFor(() => {
      expect(screen.getByText('Failed to get video chat token')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });
  });

  it('navigates to dashboard when go back is clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => null, // No token returned
    });

    render(<P2PChatRoom />);

    await waitFor(() => {
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Go Back'));

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('includes leave room button in the UI', async () => {
    render(<P2PChatRoom />);

    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    });

    expect(screen.getByText('Leave Room')).toBeInTheDocument();
  });
});
