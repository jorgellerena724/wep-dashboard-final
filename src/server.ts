import 'zone.js/node';

import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express, { Express, Request, Response, NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import bootstrap from './main.server';

export function app(): Express {
  const server: Express = express();
  const distFolder = join(process.cwd(), 'dist/wep-dashboard/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? join(distFolder, 'index.original.html')
    : join(distFolder, 'index.html');

  const commonEngine = new CommonEngine();

  // Middleware para logging
  server.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Health check endpoint
  server.get('/health', (req: Request, res: Response) => {
    const packageVersion = process.env['npm_package_version'] || '1.1.2';
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'wep-admin-dashboard',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: packageVersion
    });
  });

  // Servir archivos estáticos
  server.use(express.static(distFolder, {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    index: false,
    redirect: false
  }));

  // Ruta para favicon.ico
  server.get('/favicon.ico', (req: Request, res: Response) => {
    const faviconPath = join(distFolder, 'favicon.ico');
    if (existsSync(faviconPath)) {
      res.sendFile(faviconPath);
    } else {
      res.status(204).send();
    }
  });

  // Ruta para assets
  server.get('/assets/*', (req: Request, res: Response) => {
    const filePath = join(distFolder, req.path);
    if (existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('Not found');
    }
  });

  // Todas las demás rutas - SSR
  server.get('*', (req: Request, res: Response, next: NextFunction) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: distFolder,
        providers: [
          { provide: APP_BASE_HREF, useValue: baseUrl },
          { provide: 'REQUEST', useValue: req },
          { provide: 'RESPONSE', useValue: res }
        ],
      })
      .then((html: string) => {
        // Headers de seguridad
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // Cache control
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.send(html);
      })
      .catch((err: Error) => {
        console.error('SSR Error:', err);
        // Fallback al archivo estático index.html (CSR)
        const fallbackFile = join(distFolder, 'index.html');
        if (existsSync(fallbackFile)) {
          res.sendFile(fallbackFile);
        } else {
          next(err);
        }
      });
  });

  // Manejo de errores 404
  server.use((req: Request, res: Response) => {
    const indexFile = join(distFolder, 'index.html');
    if (existsSync(indexFile)) {
      res.status(404).sendFile(indexFile);
    } else {
      res.status(404).send('Page not found');
    }
  });

  // Manejo de errores generales
  server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Server Error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    });
    
    const indexFile = join(distFolder, 'index.html');
    if (existsSync(indexFile)) {
      res.status(500).sendFile(indexFile);
    } else {
      res.status(500).send('Internal Server Error');
    }
  });

  return server;
}

function run(): void {
  // DETECCIÓN ROBUSTA de modo PRERENDER
  const isPrerender = 
    // 1. Variable de entorno explícita
    process.env['NG_PRERENDER'] === 'true' ||
    // 2. Puerto 0 (indicador de puerto dinámico)
    process.env['PORT'] === '0' ||
    // 3. Comando contiene "prerender"
    process.argv.some(arg => arg.toLowerCase().includes('prerender')) ||
    // 4. Ruta de trabajo contiene ".angular/prerender-root/"
    process.cwd().includes('.angular/prerender-root') ||
    // 5. Argumentos contienen la ruta de prerender
    process.argv.some(arg => arg.includes('.angular/prerender-root/')) ||
    // 6. Variable NODE_ENV indica desarrollo (durante build)
    process.env['NODE_ENV'] === 'development';
  
  // LOGS de diagnóstico (solo si es prerender para no saturar)
  if (isPrerender) {
    console.log('🔧 [PRERENDER MODE] Detected prerender environment');
    console.log(`🔧 [PRERENDER MODE] CWD: ${process.cwd()}`);
    console.log(`🔧 [PRERENDER MODE] PORT from env: ${process.env['PORT']}`);
    console.log(`🔧 [PRERENDER MODE] NG_PRERENDER: ${process.env['NG_PRERENDER']}`);
    console.log(`🔧 [PRERENDER MODE] NODE_ENV: ${process.env['NODE_ENV']}`);
  }
  
  // DECISIÓN DE PUERTO: 0 durante prerender, 4004 en producción
  let defaultPort: number | string;
  
  if (isPrerender) {
    // DURANTE PRERENDER: usar puerto 0 (dinámico/aleatorio)
    defaultPort = 0;
    console.log(`🔧 [PRERENDER MODE] Using dynamic port (0 = system assigned)`);
  } else {
    // EN PRODUCCIÓN: usar puerto fijo 4004
    defaultPort = 4004;
    console.log(`🔧 [PRODUCTION MODE] Using fixed port 4004`);
  }
  
  // Obtener puerto final (variable de entorno tiene prioridad)
  const port = process.env['PORT'] ? parseInt(process.env['PORT']) : defaultPort;
  const host = process.env['HOST'] || '0.0.0.0';

  const server = app();
  
  const listener = server.listen(port, host, () => {
    const actualPort = (listener.address() as any).port;
    const address = (listener.address() as any).address;
    
    if (isPrerender) {
      // EN PRERENDER: solo log breve y comunicar puerto a Angular CLI
      console.log(`🔧 [PRERENDER MODE] Server ready on http://${address}:${actualPort}`);
      
      // COMUNICACIÓN CRÍTICA con proceso padre (Angular CLI)
      if (process.send) {
        process.send({ 
          kind: 'server-ready', 
          port: actualPort,
          address: address
        });
        console.log(`🔧 [PRERENDER MODE] Sent port ${actualPort} to parent process`);
      }
    } else {
      // EN PRODUCCIÓN: mostrar logs completos
      const distFolder = join(process.cwd(), 'dist/wep-dashboard/browser');
      console.log(`✅ Server SSR listening on: http://${address}:${actualPort}`);
      console.log(`📁 Static files from: ${distFolder}`);
      console.log(`🩺 Health check: http://${address}:${actualPort}/health`);
      console.log(`📝 Mode: ${process.env['NODE_ENV'] || 'production'}`);
    }
  });

  // Manejo de errores del listener
  listener.on('error', (error: NodeJS.ErrnoException) => {
    console.error('❌ Server listen error:', error.message);
    
    // Si es error de puerto en uso durante prerender, intentar con puerto 0
    if (error.code === 'EADDRINUSE' && isPrerender && port !== 0) {
      console.log('🔄 Retrying with dynamic port (0)...');
      listener.close();
      server.listen(0, host);
    } else {
      process.exit(1);
    }
  });

  // Manejo de señales para shutdown limpio
  const shutdown = (signal: string) => {
    if (!isPrerender) {
      console.log(`${signal} received, shutting down gracefully...`);
    }
    
    listener.close(() => {
      if (!isPrerender) {
        console.log('Server closed successfully');
      }
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      if (!isPrerender) {
        console.error('Forcing exit...');
      }
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Manejo de errores no capturados
  process.on('uncaughtException', (error: Error) => {
    console.error('❌ Uncaught Exception:', error.message);
    if (!isPrerender) {
      console.error('Stack:', error.stack);
    }
    shutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('⚠️ Unhandled Rejection at:', promise);
    if (!isPrerender && reason instanceof Error) {
      console.error('Reason:', reason.message);
    }
  });
}

// Punto de entrada
run();