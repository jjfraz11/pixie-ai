import React from 'react';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import GoLivePanel from '../GoLivePanel';

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock AuthContext
const mockUseAuth = {
  user: {
    id: 'broadcaster-user-id',
    name: 'Test Broadcaster',
    roles: ['broadcaster'],
  },
  token: 'mock-auth-token',
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
}));

// Mock fetch
global.fetch = jest.fn();

describe('GoLivePanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-session-id' }),
    });
  });

  it('renders for broadcasters', () => {
    render(<GoLivePanel />);

    expect(screen.getByText('Go Live')).toBeInTheDocument();
    expect(screen.getByText('Go Live')).toBeInTheDocument(); // Button text
  });

  it('does not render for non-broadcasters', () => {
    // Mock non-broadcaster user
    const mockUseAuthNonBroadcaster = {
      user: { id: 'regular-user-id', name: 'Regular User', roles: ['USER'] },
      token: 'mock-auth-token',
    };

    jest.doMock('../../../contexts/AuthContext', () => ({
      useAuth: () => mockUseAuthNonBroadcaster,
    }));

    const { container } = render(<GoLivePanel />);
    expect(container.firstChild).toBeNull();
  });

  it('expands and shows form when clicked', () => {
    render(<GoLivePanel />);

    const goLiveButton = screen.getByText('Go Live');
    fireEvent.click(goLiveButton);

    expect(screen.getByLabelText('Stream Title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your stream title...')).toBeInTheDocument();
    expect(screen.getByText('Start Broadcast')).toBeInTheDocument();
  });

  it('starts broadcast with valid title', async () => {
    render(<GoLivePanel />);

    // Expand the panel
    fireEvent.click(screen.getByText('Go Live'));

    // Fill in the title
    const titleInput = screen.getByPlaceholderText('Enter your stream title...');
    fireEvent.change(titleInput, { target: { value: 'My Test Stream' } });

    // Submit the form
    fireEvent.click(screen.getByText('Start Broadcast'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-auth-token',
        },
        body: JSON.stringify({
          type: 'broadcast',
          title: 'My Test Stream',
        }),
      });
    });

    expect(mockPush).toHaveBeenCalledWith('/broadcast/test-session-id');
  });

  it('shows error for empty title', async () => {
    render(<GoLivePanel />);

    // Expand the panel
    fireEvent.click(screen.getByText('Go Live'));

    // Try to submit without title
    fireEvent.click(screen.getByText('Start Broadcast'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a stream title')).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('displays error when session creation fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Failed to create session' }),
    });

    render(<GoLivePanel />);

    // Expand the panel
    fireEvent.click(screen.getByText('Go Live'));

    // Fill in the title
    const titleInput = screen.getByPlaceholderText('Enter your stream title...');
    fireEvent.change(titleInput, { target: { value: 'My Test Stream' } });

    // Submit the form
    fireEvent.click(screen.getByText('Start Broadcast'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create session')).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    // Mock a slow response
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ id: 'test-session-id' }),
              }),
            100,
          ),
        ),
    );

    render(<GoLivePanel />);

    // Expand the panel
    fireEvent.click(screen.getByText('Go Live'));

    // Fill in the title
    const titleInput = screen.getByPlaceholderText('Enter your stream title...');
    fireEvent.change(titleInput, { target: { value: 'My Test Stream' } });

    // Submit the form
    fireEvent.click(screen.getByText('Start Broadcast'));

    // Check that button is disabled and shows loading state
    await waitFor(() => {
      expect(screen.getByText('Starting Stream...')).toBeInTheDocument();
      expect(screen.getByText('Starting Stream...')).toBeDisabled();
    });
  });

  it('collapses when expand button is clicked again', () => {
    render(<GoLivePanel />);

    // Expand the panel
    fireEvent.click(screen.getByText('Go Live'));
    expect(screen.getByLabelText('Stream Title')).toBeInTheDocument();

    // Collapse the panel
    fireEvent.click(screen.getByText('Go Live'));
    expect(screen.queryByLabelText('Stream Title')).not.toBeInTheDocument();
  });
});
