module.exports = {
  apps: [
    {
      name: 'shopflow-backend',
      script: 'dist/app/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
