const mongoose = require('mongoose');

class DatabaseService {
  static async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hosting-platform';
      await mongoose.connect(mongoUri);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  static async disconnect() {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  }
}

module.exports = DatabaseService;