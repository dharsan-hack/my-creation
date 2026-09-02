const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Post = require('./models/Post');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_eventstorager_vault_2026';
const isProduction = process.env.NODE_ENV === 'production';

// --- 1. Auto-create Uploads & Paths Configuration ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Auto-created uploads directory: ${uploadsDir}`);
}

const frontendDir = path.join(__dirname, '../frontend');

// --- 2. Middleware Configuration ---
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Serve static frontend assets locally; Vercel hosts the frontend separately.
if (!isProduction) {
    app.use(express.static(frontendDir));
}
app.use('/uploads', express.static(uploadsDir));

// --- 3. In-Memory Database Fallback System ---
let isMongoConnected = false;
let inMemoryEvents = [];
let inMemoryUsers = [];

const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 3000
    }).then(async () => {
        isMongoConnected = true;
        console.log('✅ Connected to MongoDB Database successfully.');
        try {
            const count = await Post.countDocuments();
            if (count === 0) {
                await Post.insertMany([
                {
                    title: 'TechX Global Conference 2026',
                    description: 'Keynotes on AI, cloud infrastructure, and next-gen web frameworks.',
                    fileUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80',
                    fileType: 'image',
                    category: 'Conference',
                    location: 'San Francisco Convention Center',
                    tags: ['technology', 'keynote', 'ai'],
                    likes: 14,
                    userName: 'Alex Rivers'
                },
                {
                    title: 'Neon Nights Music Festival',
                    description: 'Live performances under the stars with electronic beats.',
                    fileUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
                    fileType: 'image',
                    category: 'Concert',
                    location: 'Austin Outdoor Arena',
                    tags: ['music', 'festival', 'concert'],
                    likes: 28,
                    userName: 'Elena Vance'
                },
                {
                    title: 'Championship Victory Celebration',
                    description: 'Celebrating the team victory with fans, highlights and trophies.',
                    fileUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
                    fileType: 'image',
                    category: 'Sports',
                    location: 'Downtown Arena',
                    tags: ['sports', 'champion', 'victory'],
                    likes: 42,
                    userName: 'Marcus Sterling'
                }
                ]);
                console.log('🌱 Auto-seeded initial event memories into MongoDB.');
            }
        } catch (seedErr) {
            console.error('Failed to seed MongoDB initial data:', seedErr.message);
        }
    }).catch((err) => {
        isMongoConnected = false;
        console.warn('⚠️ MongoDB connection could not be established. Falling back to active in-memory storage.');
        console.warn(`Reason: ${err.message}`);
    });
} else {
    console.warn('⚠️ MONGO_URI is not configured. Using active in-memory storage.');
}

// Seed sample events for in-memory mode if empty
function seedInMemoryData() {
    if (inMemoryEvents.length === 0) {
        inMemoryEvents = [
            {
                id: 'mem_1',
                _id: 'mem_1',
                title: 'TechX Global Conference 2026',
                description: 'Keynotes on AI, cloud infrastructure, and next-gen web frameworks.',
                fileUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80',
                fileType: 'image',
                category: 'Conference',
                location: 'San Francisco Convention Center',
                tags: ['technology', 'keynote', 'ai'],
                likes: 14,
                user: 'demo_user_1',
                userName: 'Alex Rivers',
                createdAt: new Date()
            },
            {
                id: 'mem_2',
                _id: 'mem_2',
                title: 'Neon Nights Music Festival',
                description: 'Live performances under the stars with electronic beats.',
                fileUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
                fileType: 'image',
                category: 'Concert',
                location: 'Austin Outdoor Arena',
                tags: ['music', 'festival', 'concert'],
                likes: 28,
                user: 'demo_user_2',
                userName: 'Elena Vance',
                createdAt: new Date(Date.now() - 86400000)
            }
        ];
    }
}
seedInMemoryData();

// --- 4. Authentication Middleware ---
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Access denied. Please log in to perform this action.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired authentication token. Please log in again.' });
    }
}

function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (err) {
            // Proceed without req.user if token verification fails in optional mode
        }
    }
    next();
}

// --- 5. Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'event-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime',
        'audio/mpeg', 'audio/wav', 'audio/mp3', 'application/pdf'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only images, videos, audio and PDFs are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

function determineFileType(mimetype, filename) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'other';
}

// --- 6. Authentication Routes ---

// @route   POST /api/auth/register
// @desc    Register a new user account
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
        }

        if (username.trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters long.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }

        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (isMongoConnected) {
            const existingUser = await User.findOne({
                $or: [{ email: cleanEmail }, { username: cleanUsername }]
            });

            if (existingUser) {
                if (existingUser.email === cleanEmail) {
                    return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
                }
                return res.status(400).json({ success: false, message: 'Username is already taken. Choose another.' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new User({
                username: cleanUsername,
                email: cleanEmail,
                password: hashedPassword
            });

            await newUser.save();

            const token = jwt.sign(
                { id: newUser._id, username: newUser.username, email: newUser.email },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.status(201).json({
                success: true,
                message: 'Account created successfully!',
                token,
                user: { id: newUser._id, username: newUser.username, email: newUser.email }
            });
        } else {
            const exists = inMemoryUsers.find(u => u.email === cleanEmail || u.username.toLowerCase() === cleanUsername.toLowerCase());
            if (exists) {
                return res.status(400).json({ success: false, message: 'User or email already registered.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const memUser = {
                id: 'usr_' + Date.now(),
                _id: 'usr_' + Date.now(),
                username: cleanUsername,
                email: cleanEmail,
                password: hashedPassword,
                createdAt: new Date()
            };

            inMemoryUsers.push(memUser);

            const token = jwt.sign(
                { id: memUser.id, username: memUser.username, email: memUser.email },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.status(201).json({
                success: true,
                message: 'Account created successfully (In-Memory mode)!',
                token,
                user: { id: memUser.id, username: memUser.username, email: memUser.email }
            });
        }
    } catch (err) {
        console.error('Registration Error:', err);
        return res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
app.post('/api/auth/login', async (req, res) => {
    try {
        const { account, password } = req.body;

        if (!account || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email/username and password.' });
        }

        const cleanAccount = account.trim().toLowerCase();

        if (isMongoConnected) {
            const user = await User.findOne({
                $or: [{ email: cleanAccount }, { username: new RegExp('^' + cleanAccount + '$', 'i') }]
            });

            if (!user) {
                return res.status(400).json({ success: false, message: 'Invalid credentials. User not found.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Invalid credentials. Password incorrect.' });
            }

            const token = jwt.sign(
                { id: user._id, username: user.username, email: user.email },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.json({
                success: true,
                message: 'Login successful!',
                token,
                user: { id: user._id, username: user.username, email: user.email }
            });
        } else {
            const user = inMemoryUsers.find(u => u.email === cleanAccount || u.username.toLowerCase() === cleanAccount);
            if (!user) {
                return res.status(400).json({ success: false, message: 'Invalid credentials. User not found.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Invalid credentials. Password incorrect.' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, email: user.email },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.json({
                success: true,
                message: 'Login successful!',
                token,
                user: { id: user.id, username: user.username, email: user.email }
            });
        }
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// @route   GET /api/auth/me
// @desc    Get currently logged in user info
app.get('/api/auth/me', authMiddleware, (req, res) => {
    return res.json({
        success: true,
        user: req.user
    });
});

// --- 7. Event Posts API Routes ---

// @route   GET /api/posts
// @desc    Get all stored events with optional category and search filters
app.get('/api/posts', async (req, res) => {
    try {
        const { category, search } = req.query;

        if (isMongoConnected) {
            let filter = {};
            if (category && category !== 'All') filter.category = category;
            if (search) {
                filter.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { location: { $regex: search, $options: 'i' } },
                    { tags: { $regex: search, $options: 'i' } }
                ];
            }
            const posts = await Post.find(filter).populate('user', 'username email avatar').sort({ createdAt: -1 });
            return res.json({ success: true, count: posts.length, data: posts });
        } else {
            let results = [...inMemoryEvents];
            if (category && category !== 'All') {
                results = results.filter(e => (e.category || '').toLowerCase() === category.toLowerCase());
            }
            if (search) {
                const q = search.toLowerCase();
                results = results.filter(e => 
                    (e.title || '').toLowerCase().includes(q) ||
                    (e.description || '').toLowerCase().includes(q) ||
                    (e.location || '').toLowerCase().includes(q) ||
                    (e.tags || []).some(t => t.toLowerCase().includes(q))
                );
            }
            results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return res.json({ success: true, count: results.length, data: results });
        }
    } catch (err) {
        console.error('Error fetching posts:', err);
        return res.status(500).json({ success: false, message: 'Server Error fetching events' });
    }
});

// @route   POST /api/posts
// @desc    Store new event memory & file asset
app.post('/api/posts', optionalAuthMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { title, description, category, location, tags } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Event title is required.' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Media file is required.' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const fileType = determineFileType(req.file.mimetype, req.file.filename);
        const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

        const userId = req.user ? req.user.id : null;
        const userName = req.user ? req.user.username : 'Anonymous Vault Creator';

        const postData = {
            title: title.trim(),
            description: description ? description.trim() : '',
            fileUrl,
            filename: req.file.filename,
            fileType,
            category: category || 'Other',
            location: location ? location.trim() : '',
            tags: tagsArray,
            likes: 0,
            user: userId,
            userName: userName,
            createdAt: new Date()
        };

        if (isMongoConnected) {
            const newPost = new Post(postData);
            await newPost.save();
            return res.status(201).json({ success: true, data: newPost });
        } else {
            const newMemory = {
                id: 'mem_' + Date.now(),
                _id: 'mem_' + Date.now(),
                ...postData
            };
            inMemoryEvents.unshift(newMemory);
            return res.status(201).json({ success: true, data: newMemory });
        }
    } catch (err) {
        console.error('Error storing post:', err);
        return res.status(500).json({ success: false, message: err.message || 'Server error uploading file' });
    }
});

// @route   PUT /api/posts/:id
// @desc    Update existing event memory details (with optional new file)
app.put('/api/posts/:id', optionalAuthMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, location, tags } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Event title is required.' });
        }

        const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

        if (isMongoConnected) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }
            const post = await Post.findById(id);
            if (!post) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }

            post.title = title.trim();
            post.category = category || post.category;
            post.location = location ? location.trim() : '';
            post.description = description ? description.trim() : '';
            post.tags = tagsArray;

            if (req.file) {
                if (post.filename) {
                    const oldFilePath = path.join(uploadsDir, post.filename);
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }
                }
                post.fileUrl = `/uploads/${req.file.filename}`;
                post.filename = req.file.filename;
                post.fileType = determineFileType(req.file.mimetype, req.file.filename);
            }

            await post.save();
            return res.json({ success: true, message: 'Event updated successfully!', data: post });
        } else {
            const index = inMemoryEvents.findIndex(e => e.id === id || e._id === id);
            if (index === -1) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }

            const post = inMemoryEvents[index];
            post.title = title.trim();
            post.category = category || post.category;
            post.location = location ? location.trim() : '';
            post.description = description ? description.trim() : '';
            post.tags = tagsArray;

            if (req.file) {
                if (post.filename) {
                    const oldFilePath = path.join(uploadsDir, post.filename);
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }
                }
                post.fileUrl = `/uploads/${req.file.filename}`;
                post.filename = req.file.filename;
                post.fileType = determineFileType(req.file.mimetype, req.file.filename);
            }

            inMemoryEvents[index] = post;
            return res.json({ success: true, message: 'Event updated successfully!', data: post });
        }
    } catch (err) {
        console.error('Error updating post:', err);
        return res.status(500).json({ success: false, message: err.message || 'Server error updating event.' });
    }
});

// @route   POST /api/posts/:id/like
// @desc    Increment like count for an event
app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const { id } = req.params;

        if (isMongoConnected) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }
            const post = await Post.findById(id);
            if (!post) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }
            post.likes += 1;
            await post.save();
            return res.json({ success: true, likes: post.likes });
        } else {
            const eventObj = inMemoryEvents.find(e => e.id === id || e._id === id);
            if (!eventObj) {
                return res.status(404).json({ success: false, message: 'Event not found.' });
            }
            eventObj.likes = (eventObj.likes || 0) + 1;
            return res.json({ success: true, likes: eventObj.likes });
        }
    } catch (err) {
        console.error('Error liking post:', err);
        return res.status(500).json({ success: false, message: 'Error updating like count' });
    }
});

// @route   DELETE /api/posts/:id
// @desc    Delete event and remove uploaded file
app.delete('/api/posts/:id', optionalAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        if (isMongoConnected) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }
            const post = await Post.findById(id);
            if (!post) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }

            if (post.filename) {
                const filePath = path.join(uploadsDir, post.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await Post.findByIdAndDelete(id);
            return res.json({ success: true, message: 'Event deleted successfully.' });
        } else {
            const index = inMemoryEvents.findIndex(e => e.id === id || e._id === id);
            if (index === -1) {
                return res.status(404).json({ success: false, message: 'Event post not found.' });
            }

            const eventObj = inMemoryEvents[index];
            if (eventObj.filename) {
                const filePath = path.join(uploadsDir, eventObj.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            inMemoryEvents.splice(index, 1);
            return res.json({ success: true, message: 'Event deleted successfully.' });
        }
    } catch (err) {
        console.error('Error deleting post:', err);
        return res.status(500).json({ success: false, message: 'Server Error deleting event.' });
    }
});

// --- 8. Fallback Catch-all for SPA Navigation ---
if (!isProduction) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDir, 'index.html'));
    });
}

// --- 9. Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error('⚠️ Server Error:', err.message);
    if (err instanceof multer.MulterError || (err.message && err.message.includes('Invalid file format'))) {
        return res.status(400).json({ success: false, message: err.message || 'Upload format error' });
    }
    return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// --- 10. Server Initialization ---
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Event Storager server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
