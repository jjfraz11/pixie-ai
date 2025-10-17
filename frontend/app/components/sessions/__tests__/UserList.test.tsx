import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserList from '../UserList';

// Mock the AuthContext
const mockUseAuth = {
  token: 'mock-token',
};

jest.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
}));

// Mock fetch
global.fetch = jest.fn();

// Mock users data
const mockUsers = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
  { id: '3', name: 'Carol Davis', email: 'carol@example.com' },
];

describe('UserList Component', () => {
  const mockOnSelectUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUsers,
    });
  });

  it('renders loading state initially', () => {
    render(<UserList />);

    expect(screen.getByText('Select a User to Invite')).toBeInTheDocument();
    expect(screen.getByRole('generic', { hidden: true })).toHaveClass('animate-spin');
  });

  it('displays users after loading', async () => {
    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.getByText('Carol Davis')).toBeInTheDocument();
    });
  });

  it('filters users based on search term', async () => {
    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users...');
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
      expect(screen.queryByText('Carol Davis')).not.toBeInTheDocument();
    });
  });

  it('calls onSelectUser when a user is clicked', async () => {
    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Alice Johnson'));

    expect(mockOnSelectUser).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('highlights selected user', async () => {
    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    const aliceCard = screen.getByText('Alice Johnson').closest('div');
    expect(aliceCard).toHaveClass('border-blue-500', 'bg-blue-50');
  });

  it('displays error state when fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to fetch')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries fetch when retry button is clicked', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    });

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
