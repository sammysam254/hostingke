const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  repository: {
    provider: { type: String, enum: ['github', 'gitlab', 'bitbucket'] },
    url: String,
    branch: { type: String, default: 'main' },
    privateKey: String
  },
  buildSettings: {
    command: String,
    directory: { type: String, default: 'dist' },
    environment: { type: Map, of: String }
  },
  domains: [{
    domain: String,
    isCustom: Boolean,
    sslEnabled: { type: Boolean, default: true },
    sslCertificate: String,
    verified: { type: Boolean, default: false }
  }],
  deployments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment'
  }],
  functions: [{
    name: String,
    path: String,
    runtime: { type: String, enum: ['nodejs', 'python', 'go'], default: 'nodejs' }
  }],
  forms: [{
    name: String,
    endpoint: String,
    notifications: [String] // email addresses
  }],
  splitTests: [{
    name: String,
    branches: [{
      name: String,
      traffic: Number, // percentage
      deploymentId: mongoose.Schema.Types.ObjectId
    }],
    active: { type: Boolean, default: false }
  }],
  analytics: {
    enabled: { type: Boolean, default: true },
    trackingId: String
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true
});

projectSchema.index({ owner: 1, slug: 1 });
projectSchema.index({ 'domains.domain': 1 });

module.exports = mongoose.model('Project', projectSchema);