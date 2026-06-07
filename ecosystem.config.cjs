module.exports = {
  apps: [
    {
      name: 'personal-todo',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      time: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: '38887',
        TODO_DATA_DIR: './data'
      }
    }
  ]
};
