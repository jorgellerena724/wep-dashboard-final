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
  // DETECTAR si estamos en modo PRERENDER (durante el build)
  const isPrerender = process.argv.some(arg => 
    arg.includes('prerender') || 
    arg.includes('.angular/prerender-root/')
  );
  
  // USAR PUERTO 0 (aleatorio) durante prerender, 4004 en producción
  // Puerto 0 = el sistema asigna un puerto libre automáticamente
  const defaultPort = isPrerender ? 0 : 4004;
  
  const port = process.env['PORT'] || defaultPort;
  const host = process.env['HOST'] || '0.0.0.0';

  const server = app();
  
  const listener = server.listen(parseInt(port as string), host, () => {
    const actualPort = (listener.address() as any).port;
    
    // Solo mostrar logs si NO es prerender
    if (!isPrerender) {
      const distFolder = join(process.cwd(), 'dist/wep-dashboard/browser');
      console.log(`✅ Server SSR listening on: http://${host}:${actualPort}`);
      console.log(`📁 Static files from: ${distFolder}`);
      console.log(`🩺 Health check: http://${host}:${actualPort}/health`);
      console.log(`📝 Mode: ${process.env['NODE_ENV'] || 'development'}`);
    }
    
    // Comunicar el puerto al proceso padre (Angular CLI)
    // Esto es CRUCIAL para que Angular sepa en qué puerto está el servidor
    if (isPrerender && process.send) {
      process.send({ 
        kind: 'server-ready', 
        port: actualPort 
      });
    }
  });

  // Manejo de señales para shutdown limpio
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    
    listener.close(() => {
      console.log('Server closed successfully');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forcing exit...');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Error handling
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

// Punto de entrada
run();