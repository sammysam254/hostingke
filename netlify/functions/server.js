const serverless = require('serverless-http');
const platform = require('../../src/server');

// Export the serverless function
module.exports.handler = serverless(platform.app);