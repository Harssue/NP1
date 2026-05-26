import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // In production the frontend is served by the same Node server (port 5000),
    // so we connect to the same origin. In dev we target the Node dev server.
    const SOCKET_URL = import.meta.env.VITE_API_URL
      || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

    const socket = io(SOCKET_URL, {
      // No custom path — use the default /socket.io
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: token ? { token } : {},
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  // Emit 'start-auction' (kebab-case, matching the backend listener)
  const emitStartAuction = useCallback((gameId) => {
    if (socketRef.current) {
      socketRef.current.emit('start-auction', { gameId });
    }
  }, []);

  const joinLobby = useCallback((gameId, userId) => {
    if (socketRef.current) {
      socketRef.current.emit('join-lobby', { gameId, userId });
    }
  }, []);

  const placeBid = useCallback((gameId, gameTeamId, amount) => {
    if (socketRef.current) {
      socketRef.current.emit('place-bid', { gameId, gameTeamId, amount });
    }
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        joinLobby,
        placeBid,
        emitStartAuction,
        on,
        off,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
