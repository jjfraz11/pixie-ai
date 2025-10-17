'use client';

import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/app/contexts/AuthContext';
import { useSession } from '@/app/contexts/SessionContext';
import { getUsersAPI } from '@/app/lib/api';

import { User } from '@/app/types/auth';

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { token = '', selectedUser, setSelectedUser } = useAuth();
  const {
    sessionLink,
    isPrivate,
    setIsPrivate,
    password,
    setPassword,
    title,
    setTitle,
    createSession,
    error: sessionError,
  } = useSession();
  const [error, setError] = useState<string | null>(null);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    [setSearchTerm],
  );

  const handleUserSelect = useCallback(
    (user: User) => (e: React.MouseEvent) => {
      // T039: In a real implementation, check user availability before selecting
      // For example, call an API to check if user is online/available
      // For now, assume users are available
      setSelectedUser(user);
      // Set default title when user is selected
      setTitle(`${user.email}'s Room`);
    },
    [setSelectedUser, setTitle],
  );

  const fetchUsers = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const data = await getUsersAPI(token);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(
    (user) =>
      (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // click handler for create session
  const handleCreateSession = useCallback(
    (e: React.MouseEvent) => {
      createSession(selectedUser!, token);
    },
    [createSession, selectedUser, token],
  );

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-red-600 text-center">
          <p>Error: {error}</p>
          <button onClick={fetchUsers} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Select a User to Invite</h2>

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* User List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            {searchTerm ? 'No users found matching your search.' : 'No users available.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`p-3 border rounded-md cursor-pointer transition-colors ${
                  selectedUser?.id === user.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={handleUserSelect(user)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name || user.email}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Creation */}
      {selectedUser && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold">Create P2P Session with {selectedUser.email}</h3>
          <div className="mt-2 space-y-2">
            <div>
              <label htmlFor="session-title" className="block text-sm font-medium text-gray-700">
                Session Title
              </label>
              <input
                id="session-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${selectedUser.email}'s Room`}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div className="flex items-center">
              <input
                id="is-private"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is-private" className="ml-2 block text-sm text-gray-900">
                Private Session
              </label>
            </div>
            {isPrivate && (
              <div>
                <label htmlFor="session-password" className="block text-sm font-medium text-gray-700">
                  Session Password
                </label>
                <input
                  id="session-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            )}
          </div>
          <button
            onClick={handleCreateSession}
            className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Create Session
          </button>
          {sessionLink && (
            <div className="mt-4 p-2 bg-gray-100 rounded-md">
              <p className="text-sm font-medium text-gray-900">Session Link:</p>
              <input
                type="text"
                readOnly
                value={sessionLink}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 sm:text-sm"
              />
            </div>
          )}
          {sessionError && <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{sessionError}</div>}
        </div>
      )}
    </div>
  );
}
