const express = require('express');
const router = express.Router();
const { 
  signup, login, me, 
  updateProfile, searchUsers, 
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, getFriends, getFriendRequests,
  incrementStat,
  addBookmark, getBookmarks, removeBookmark 
} = require('../controllers/authController');
const authMiddleware = require('../src/middleware');

router.post('/signup', signup);
router.post('/login',  login);
router.get('/me',      authMiddleware, me);

// Profile & Social
router.post('/update-profile', authMiddleware, updateProfile);
router.get('/search',         authMiddleware, searchUsers);
router.get('/friends',        authMiddleware, getFriends);
router.get('/friend-requests', authMiddleware, getFriendRequests);
router.post('/friend-request', authMiddleware, sendFriendRequest);
router.post('/friend-request/accept', authMiddleware, acceptFriendRequest);
router.post('/friend-request/decline', authMiddleware, declineFriendRequest);
router.post('/increment-stat', authMiddleware, incrementStat);

// Bookmarks
router.post('/bookmark', authMiddleware, addBookmark);
router.get('/bookmarks', authMiddleware, getBookmarks);
router.delete('/bookmark/:timestamp', authMiddleware, removeBookmark);

module.exports = router;
