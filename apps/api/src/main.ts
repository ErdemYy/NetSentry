import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('NetSentryBootstrap');
  const app = await NestFactory.create(AppModule);

  // Security Headers via Helmet (with CSP configured safely for websocket & fonts)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Cookie Parser for HTTP-only JWT session management
  app.use(cookieParser());

  // Global Exception Filter for structured errors without leaking SQL/internals
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS Policy with strict credentials support
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`NetSentry Core API running securely on http://localhost:${port}`);
}

bootstrap();
