import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserList from '../UserList';

// Mock the AuthContext
const mockUseAuth = {
  token: 'mock-token',
  selectedUser: null,
  setSelectedUser: jest.fn(),
};

jest.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
}));

// Mock the SessionContext
const mockUseSession = {
  sessionLink: null,
  isPrivate: false,
  setIsPrivate: jest.fn(),
  password: '',
  setPassword: jest.fn(),
  title: '',
  setTitle: jest.fn(),
  createSession: jest.fn(),
  error: null,
};

jest.mock('@/app/contexts/SessionContext', () => ({
  useSession: () => mockUseSession,
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
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUsers,
    });
    mockUseAuth.selectedUser = null;
  });

  it('renders loading state initially', () => {
    render(<UserList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search users...');
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
  });

  it('calls setSelectedUser and setTitle when a user is clicked', async () => {
    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Alice Johnson'));

    expect(mockUseAuth.setSelectedUser).toHaveBeenCalledWith(mockUsers[0]);
    expect(mockUseSession.setTitle).toHaveBeenCalledWith("alice@example.com's Room");
  });

  it('highlights selected user', async () => {
    mockUseAuth.selectedUser = mockUsers[0];
    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const aliceCard = screen.getByText('Alice Johnson').closest('div.p-3');
    expect(aliceCard).toHaveClass('border-blue-500', 'bg-blue-50');
  });

  it('shows session creation form when a user is selected', async () => {
    mockUseAuth.selectedUser = mockUsers[0];
    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    expect(screen.getByText(`Create P2P Session with ${mockUsers[0].email}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Session Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Private Session')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Session' })).toBeInTheDocument();
  });

  it('calls createSession when the create session button is clicked', async () => {
    mockUseAuth.selectedUser = mockUsers[0];
    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    expect(mockUseSession.createSession).toHaveBeenCalledWith(mockUsers[0], 'mock-token');
  });

  it('shows password field when private session is checked', async () => {
    mockUseAuth.selectedUser = mockUsers[0];
    mockUseSession.isPrivate = true;
    render(<UserList />);
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    expect(screen.getByLabelText('Session Password')).toBeInTheDocument();
  });
});
