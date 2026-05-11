import { io } from 'socket.io-client';

const CHAT_URL = process.env.REACT_APP_CHAT_URL || 'http://localhost:5002';
const GAME_URL = process.env.REACT_APP_GAME_URL || 'http://localhost:5004';

let socket = null;
let gameSocket = null;

export const getSocket = () => socket;
export const getGameSocket = () => gameSocket;

export const connectSocket = (token) => {
  if (socket) socket.disconnect();
  socket = io(CHAT_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  return socket;
};

export const connectGameSocket = (token, query = {}) => {
  if (gameSocket) gameSocket.disconnect();
  gameSocket = io(GAME_URL, {
    auth: { token },
    query,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  return gameSocket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
  if (gameSocket) { gameSocket.disconnect(); gameSocket = null; }
};
