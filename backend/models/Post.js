const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    fileUrl: {
        type: String,
        required: [true, 'Media file URL is required']
    },
    filename: {
        type: String,
        default: ''
    },
    fileType: {
        type: String,
        enum: ['image', 'video', 'audio', 'other'],
        default: 'image'
    },
    category: {
        type: String,
        enum: ['Concert', 'Conference', 'Celebration', 'Sports', 'Personal', 'Other'],
        default: 'Other'
    },
    location: {
        type: String,
        trim: true,
        default: ''
    },
    tags: [{
        type: String,
        trim: true
    }],
    likes: {
        type: Number,
        default: 0
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    userName: {
        type: String,
        default: 'Anonymous'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Post', PostSchema);
