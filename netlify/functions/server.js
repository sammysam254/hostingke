const serverless = require('serverless-http');
const app = require('../../src/server');

// Export the serverless function
module.exports.handler = serverless(app.app);