import axios from 'axios';

const AUTH_URL = process.env.REACT_APP_AUTH_URL || 'http://localhost:5001';

const api = axios.create({ baseURL: AUTH_URL });

export const signup = (data) => api.post('/api/auth/signup', data);
export const login  = (data) => api.post('/api/auth/login',  data);
export const getMe  = (token) =>
  api.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });

export const updateProfile = (token, data) => 
  api.post('/api/auth/update-profile', data, { headers: { Authorization: `Bearer ${token}` } });

export const searchUsers = (token, q) => 
  api.get(`/api/auth/search?q=${q}`, { headers: { Authorization: `Bearer ${token}` } });

export const getFriends = (token) => 
  api.get('/api/auth/friends', { headers: { Authorization: `Bearer ${token}` } });

export const sendFriendRequest = (token, friendId) => 
  api.post('/api/auth/friend-request', { friendId }, { headers: { Authorization: `Bearer ${token}` } });

export const acceptFriendRequest = (token, friendId) => 
  api.post('/api/auth/friend-request/accept', { friendId }, { headers: { Authorization: `Bearer ${token}` } });

export const declineFriendRequest = (token, friendId) => 
  api.post('/api/auth/friend-request/decline', { friendId }, { headers: { Authorization: `Bearer ${token}` } });

export const getFriendRequests = (token) => 
  api.get('/api/auth/friend-requests', { headers: { Authorization: `Bearer ${token}` } });

export const incrementStat = (token, field, amount = 1) =>
  api.post('/api/auth/increment-stat', { field, amount }, { headers: { Authorization: `Bearer ${token}` } });
