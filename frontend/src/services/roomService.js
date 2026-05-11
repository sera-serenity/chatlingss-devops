import axios from 'axios';

const BASE_URL = process.env.REACT_APP_MESSAGE_URL || 'http://localhost:5003';

const api = axios.create({ baseURL: BASE_URL });

export const getRooms = () => api.get('/api/rooms');

export const createRoom = (data, token) =>
  api.post('/api/rooms/create', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const verifyCode = (roomId, code, token) =>
  api.post('/api/rooms/verify-code', { roomId, code }, {
    headers: { Authorization: `Bearer ${token}` },
  });
