'use client';

import { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { User } from '../types/auth';

interface SessionContextType {
  sessionLink: string | null;
  isPrivate: boolean;
  setIsPrivate: (isPrivate: boolean) => void;
  password: string;
  setPassword: (password: string) => void;
  title: string;
  setTitle: (title: string) => void;
  createSession: (user: User, token: string) => Promise<void>;
  error: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (user: User, token = '') => {
      setError(null);
      // Set default title if none provided
      const sessionTitle = title || `${user.email}'s Room`;

      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            // Add bearer header to pass access token
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'P2P',
            accessType: isPrivate ? 'PRIVATE' : 'PUBLIC',
            password: isPrivate ? password : null,
            title: sessionTitle,
            hostId: user.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create session');
        }

        const session = await response.json();
        setSessionLink(`${window.location.origin}/p2p/${session.sessionId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    },
    [isPrivate, password],
  );

  return (
    <SessionContext.Provider
      value={{
        sessionLink,
        isPrivate,
        setIsPrivate,
        password,
        setPassword,
        title,
        setTitle,
        createSession,
        error,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
