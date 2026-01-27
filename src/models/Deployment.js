const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  commitSha: String,
  commitMessage: String,
  branch: String,
  status: {
    type: String,
    enum: ['queued', 'building', 'ready', 'error', 'cancelled'],
    default: 'queued'
  },
  buildLog: [String],
  buildTime: Number, // in seconds
  size: Number, // in bytes
  url: String,
  previewUrl: String,
  environment: {
    type: String,
    enum: ['production', 'preview', 'branch-deploy'],
    default: 'production'
  },
  buildSettings: {
    command: String,
    directory: String,
    environment: { type: Map, of: String }
  },
  assets: [{
    path: String,
    size: Number,
    hash: String,
    contentType: String
  }],
  functions: [{
    name: String,
    size: Number,
    runtime: String
  }],
  performance: {
    buildTime: Number,
    bundleSize: Number,
    lighthouse: {
      performance: Number,
      accessibility: Number,
      bestPractices: Number,
      seo: Number
    }
  },
  error: {
    message: String,
    stack: String,
    step: String
  }
}, {
  timestamps: true
});

deploymentSchema.index({ project: 1, createdAt: -1 });
deploymentSchema.index({ status: 1 });
deploymentSchema.index({ commitSha: 1 });

module.exports = mongoose.model('Deployment', deploymentSchema);