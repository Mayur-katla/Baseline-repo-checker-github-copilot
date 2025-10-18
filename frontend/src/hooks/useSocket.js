import { useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (url) => {
  const backendUrl = (() => {
    // Prefer explicit backend URL; fall back to same origin when not provided
    const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || undefined;
    const normalized = (url && url !== '/') ? url : envUrl || (typeof window !== 'undefined' ? window.location.origin : undefined);
    return normalized;
  })();

  const socket = useMemo(() => {
    const options = {
      path: '/socket.io',
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    };
    return backendUrl ? io(backendUrl, options) : io(options);
  }, [backendUrl]);

  useEffect(() => {
    console.log('[socket] init: connected?', socket.connected, 'url:', backendUrl);
    if (!socket.connected) {
      console.log('[socket] forcing connect…');
      try { socket.connect(); } catch {}
    }
    const onConnect = () => console.log('[socket] connected:', socket.id);
    const onConnectError = (error) => {
      console.log('[socket] connect_error:', error?.message, 'name:', error?.name, 'desc:', error?.description);
    };
    const onReconnectError = (error) => console.log('[socket] reconnect_error:', error?.message);
    const onDisconnect = (reason) => console.log('[socket] disconnected:', reason);

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('reconnect_error', onReconnectError);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('reconnect_error', onReconnectError);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [socket, backendUrl]);

  return socket;
};