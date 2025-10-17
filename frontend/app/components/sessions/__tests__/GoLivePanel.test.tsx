import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GoLivePanel from '../GoLivePanel';
import * as AuthContext from '@/contexts/AuthContext';
import * as api from '@/lib/api';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('GoLivePanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders for broadcasters', () => {
    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '1', roles: ['broadcaster'] },
      token: 'fake-token',
    } as any);
    render(<GoLivePanel />);
    expect(screen.getByText('Go Live')).toBeInTheDocument();
  });

  it('does not render for non-broadcasters', () => {
    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '2', roles: ['user'] },
      token: 'fake-token',
    } as any);
    const { container } = render(<GoLivePanel />);
    expect(container.firstChild).toBeNull();
  });

  it('expands and shows form when clicked', () => {
    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '1', roles: ['broadcaster'] },
      token: 'fake-token',
    } as any);
    render(<GoLivePanel />);
    fireEvent.click(screen.getByText('Go Live'));
    expect(screen.getByLabelText('Stream Title')).toBeInTheDocument();
  });

  it('starts broadcast with valid title', async () => {
    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '1', roles: ['broadcaster'] },
      token: 'fake-token',
    } as any);
    const goLiveSpy = jest.spyOn(api, 'goLive').mockResolvedValue({ id: 'session-123' } as any);

    render(<GoLivePanel />);
    fireEvent.click(screen.getByText('Go Live'));
    fireEvent.change(screen.getByLabelText('Stream Title'), { target: { value: 'My Stream' } });
    fireEvent.click(screen.getByText('Start Broadcast'));

    await waitFor(() => {
      expect(goLiveSpy).toHaveBeenCalledWith('fake-token', 'My Stream');
      expect(mockPush).toHaveBeenCalledWith('/broadcast/session-123');
    });
  });

  it('shows error for empty title', async () => {
    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '1', roles: ['broadcaster'] },
      token: 'fake-token',
    } as any);
    render(<GoLivePanel />);
    fireEvent.click(screen.getByText('Go Live'));
    fireEvent.click(screen.getByText('Start Broadcast'));
    expect(await screen.findByText('Please enter a stream title')).toBeInTheDocument();
  });

  it('displays error when session creation fails', async () => {
    jest.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '1', roles: ['broadcaster'] },
      token: 'fake-token',
    } as any);
    jest.spyOn(api, 'goLive').mockRejectedValue(new Error('Failed to start stream'));

    render(<GoLivePanel />);
    fireEvent.click(screen.getByText('Go Live'));
    fireEvent.change(screen.getByLabelText('Stream Title'), { target: { value: 'My Stream' } });
    fireEvent.click(screen.getByText('Start Broadcast'));

    expect(await screen.findByText('Failed to start stream')).toBeInTheDocument();
  });
});
