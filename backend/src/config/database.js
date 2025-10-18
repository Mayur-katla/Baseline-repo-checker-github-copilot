const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// MongoDB connection URI (default to local MongoDB instance if not provided)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/baseline-autopilot';

// Connect to MongoDB
const connectDB = async () => {
  let timeoutId;
  try {
    // Add timeout to avoid hanging if MongoDB is not available
    const connectPromise = mongoose.connect(MONGODB_URI);
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    const { logError } = require('../utils/logger');
    logError({ module: 'database', location: 'connectDB', message: 'MongoDB connection error', context: { uri: MONGODB_URI } }, error);
    // Fallback to in-memory MongoDB server if real MongoDB connection fails
    console.log('Falling back to in-memory MongoDB server');

    try {
      // Create an in-memory MongoDB instance
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();

      // Connect to the in-memory MongoDB instance
      await mongoose.connect(mongoUri);
      console.log('Connected to in-memory MongoDB server');
      return true;
    } catch (memoryError) {
      logError({ module: 'database', location: 'connectDB fallback', message: 'Failed to create in-memory MongoDB', context: {} }, memoryError);
      console.log('Using basic in-memory storage');
      return false;
    }
  }
};

module.exports = { connectDB };