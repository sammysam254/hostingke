const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true
  },
  avatar: String,
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  usage: {
    bandwidth: { type: Number, default: 0 },
    buildMinutes: { type: Number, default: 0 },
    sites: { type: Number, default: 0 }
  },
  limits: {
    bandwidth: { type: Number, default: 100 * 1024 * 1024 * 1024 }, // 100GB
    buildMinutes: { type: Number, default: 300 },
    sites: { type: Number, default: 10 }
  },
  gitProviders: [{
    provider: { type: String, enum: ['github', 'gitlab', 'bitbucket'] },
    accessToken: String,
    refreshToken: String,
    username: String
  }],
  isVerified: { type: Boolean, default: false },
  verificationToken: String
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);