import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Page from '../page';

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
    user: { id: 'user1', email: 'user1@example.com' },
    token: 'mock-auth-token',
  }),
}));

// Mock LiveKit hooks
const mockRoom = {
  name: 'test-room',
  disconnect: jest.fn(),
};
const mockLocalParticipant = {
  identity: 'user1',
  setCameraEnabled: jest.fn(),
  setMicrophoneEnabled: jest.fn(),
};
const mockRemoteParticipant = {
  identity: 'user2',
};

jest.mock('@livekit/components-react', () => ({
  useRoomContext: () => mockRoom,
  useLocalParticipant: () => ({ localParticipant: mockLocalParticipant }),
  useParticipants: () => [mockLocalParticipant, mockRemoteParticipant],
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div data-testid="livekit-room">{children}</div>,
  VideoConference: () => <div data-testid="video-conference" />,
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
}));

// Mock fetch
global.fetch = jest.fn();

describe('P2P Chat Room Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'mock-livekit-token', wsUrl: 'ws://localhost:7880' }),
    });
  });

  it('renders loading state initially', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Prevent fetch from resolving
    render(<Page params={{ sessionId: 'test-session' }} />);
    expect(await screen.findByText(/connecting to session/i)).toBeInTheDocument();
  });

  it('renders P2P controls and participants', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);

    expect(await screen.findByText(/p2p session: test-session/i)).toBeInTheDocument();
    expect(await screen.findByText(/user1/i)).toBeInTheDocument(); // Local participant
    expect(await screen.findByText(/user2/i)).toBeInTheDocument(); // Remote participant
    expect(await screen.findByRole('button', { name: /toggle camera/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /toggle microphone/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /leave session/i })).toBeInTheDocument();
  });

  it('toggles camera on button click', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);
    const toggleCameraButton = await screen.findByRole('button', { name: /toggle camera/i });

    fireEvent.click(toggleCameraButton);
    await waitFor(() => {
      expect(mockLocalParticipant.setCameraEnabled).toHaveBeenCalledWith(false);
    });
  });

  it('toggles microphone on button click', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);
    const toggleMicrophoneButton = await screen.findByRole('button', { name: /toggle microphone/i });

    fireEvent.click(toggleMicrophoneButton);
    await waitFor(() => {
      expect(mockLocalParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    });
  });

  it('leaves session on button click', async () => {
    render(<Page params={{ sessionId: 'test-session' }} />);
    const leaveSessionButton = await screen.findByRole('button', { name: /leave session/i });

    fireEvent.click(leaveSessionButton);
    expect(mockRoom.disconnect).toHaveBeenCalledTimes(1);
  });
});
