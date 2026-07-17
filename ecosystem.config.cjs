const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('./src/load-env.cjs');

loadEnvFile(path.join(__dirname, '.env'));

const deployRoot = path.join(__dirname, '.deploy');
const sharedRoot = path.join(deployRoot, 'shared');
const currentReleaseDir = path.join(deployRoot, 'current');
const runtimeCwd = fs.existsSync(path.join(currentReleaseDir, 'server.js'))
  ? currentReleaseDir
  : __dirname;
const sharedDataDir = process.env.TODO_DATA_DIR || path.join(__dirname, 'data');
const sharedLogsDir = process.env.TODO_LOG_DIR || path.join(sharedRoot, 'logs');
const mcpToken = process.env.TODO_MCP_TOKEN || '';

fs.mkdirSync(sharedDataDir, { recursive: true });
fs.mkdirSync(sharedLogsDir, { recursive: true });

module.exports = {
  apps: [
    {
      name: 'personal-todo',
      script: 'server.js',
      cwd: runtimeCwd,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      time: true,
      autorestart: true,
      max_memory_restart: '300M',
      out_file: path.join(sharedLogsDir, 'personal-todo.out.log'),
      error_file: path.join(sharedLogsDir, 'personal-todo.error.log'),
      env: {
        NODE_ENV: 'production',
        PORT: '38887',
        TODO_DATA_DIR: sharedDataDir
      }
    },
    {
      name: 'personal-todo-mcp',
      script: 'src/mcp/server.js',
      cwd: runtimeCwd,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      time: true,
      autorestart: true,
      max_memory_restart: '300M',
      out_file: path.join(sharedLogsDir, 'personal-todo-mcp.out.log'),
      error_file: path.join(sharedLogsDir, 'personal-todo-mcp.error.log'),
      env: {
        NODE_ENV: 'production',
        TODO_MCP_HOST: process.env.TODO_MCP_HOST || '127.0.0.1',
        TODO_MCP_PORT: process.env.TODO_MCP_PORT || '38888',
        TODO_MCP_ALLOWED_ORIGINS: process.env.TODO_MCP_ALLOWED_ORIGINS || '',
        TODO_MCP_TOKEN: mcpToken,
        TODO_DATA_DIR: sharedDataDir
      }
    }
  ]
};
