const User = require('../models/User');
const { generateToken } = require('../src/jwt');

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { username, email, password, avatar, color, mood, prop } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email and password are required' });

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(409).json({ error: 'User already exists' });

    const user = await User.create({ username, email, password, avatar, color, mood, prop });
    const token = generateToken({ id: user._id, username: user.username });

    res.status(201).json({
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar, 
        color: user.color, 
        mood: user.mood, 
        prop: user.prop,
        roomsJoined: user.roomsJoined,
        wordsGuessed: user.wordsGuessed,
        gamesWon: user.gamesWon,
        friends: user.friends
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken({ id: user._id, username: user.username });

    res.json({
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar, 
        color: user.color, 
        mood: user.mood, 
        prop: user.prop,
        roomsJoined: user.roomsJoined,
        wordsGuessed: user.wordsGuessed,
        gamesWon: user.gamesWon,
        friends: user.friends
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/auth/me  (protected - needs JWT middleware on router)
const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Bookmarks
const addBookmark = async (req, res) => {
  try {
    const { senderName, text, roomId, timestamp } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { bookmarks: { senderName, text, roomId, timestamp: timestamp || new Date() } } },
      { new: true }
    );
    res.json(user.bookmarks);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user.bookmarks || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeBookmark = async (req, res) => {
  try {
    const { timestamp } = req.params;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { bookmarks: { timestamp: new Date(timestamp) } } },
      { new: true }
    );
    res.json(user.bookmarks);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update Profile (protected)
const updateProfile = async (req, res) => {
  try {
    const { username, avatar, color, mood, prop } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { username, avatar, color, mood, prop } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Social APIs (protected)
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await User.find({ 
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user.id } // Exclude self
    }).select('username avatar color');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const sendFriendRequest = async (req, res) => {
  try {
    const { friendId } = req.body;
    if (friendId === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });
    
    // Add to recipient's friendRequests
    const friend = await User.findByIdAndUpdate(
      friendId,
      { $addToSet: { friendRequests: req.user.id } },
      { new: true }
    );
    
    if (!friend) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'Friend request sent ✨' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const acceptFriendRequest = async (req, res) => {
  try {
    const { friendId } = req.body;
    
    // Check if request exists
    const user = await User.findById(req.user.id);
    if (!user.friendRequests.includes(friendId)) {
        return res.status(400).json({ error: 'No request from this user' });
    }

    // 1. Add reciprocally to friends
    await User.findByIdAndUpdate(req.user.id, { 
        $addToSet: { friends: friendId },
        $pull: { friendRequests: friendId }
    });
    await User.findByIdAndUpdate(friendId, { 
        $addToSet: { friends: req.user.id }
    });

    const updatedUser = await User.findById(req.user.id).populate('friends', 'username avatar color');
    res.json({ success: true, friends: updatedUser.friends });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const declineFriendRequest = async (req, res) => {
  try {
    const { friendId } = req.body;
    await User.findByIdAndUpdate(req.user.id, { 
        $pull: { friendRequests: friendId }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getFriendRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friendRequests', 'username avatar color');
    res.json(user.friendRequests || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friends', 'username avatar color');
    res.json(user.friends || []);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const incrementStat = async (req, res) => {
  try {
    const { field, amount = 1 } = req.body;
    const allowed = ['roomsJoined', 'wordsGuessed', 'gamesWon'];
    if (!allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' });
    
    await User.findByIdAndUpdate(req.user.id, { $inc: { [field]: amount } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { 
  signup, login, me, 
  addBookmark, getBookmarks, removeBookmark,
  updateProfile, searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest, getFriends, getFriendRequests,
  incrementStat
};
