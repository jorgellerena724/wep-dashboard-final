module.exports = {
  apps: [
    {
      name: 'wep-admin-ssr',
      script: 'dist/wep-dashboard/server/server.mjs',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // Variables de entorno
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '0.0.0.0',
        NODE_OPTIONS: '--max-old-space-size=512'
      },
      
      // Configuración de logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      pid_file: 'logs/pm2.pid',
      
      // Control de procesos
      min_uptime: '30s',
      max_restarts: 5,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100
    }
  ]
};