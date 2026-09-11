import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { defineConfig, type ViteDevServer } from 'vite';
import { craftStyle } from '@craft-ts/style/vite';
import { createPresentationApi } from './src/server/presentation-api';
import {
  createPresentationImageStore,
  PresentationImageError,
} from './src/server/presentation-images';
import {
  PRESENTATION_MEDIA_MIME_TYPES,
  type PresentationMediaMimeType,
  type PresentationImageUploadInput,
} from './src/shared/presentation';
import { PRESENTATION_DEMO_WORKSPACES } from './src/shared/presentation';
import { readDemoWorkspace } from './src/server/demo-workspaces';

const typecheckStatusPath = new URL('./.craft/typecheck-status.json', import.meta.url);
const starterPort = Number(process.env.CRAFT_STARTER_PORT ?? 4173);
const presentationDatabasePath = process.env.CRAFT_PRESENTATION_DB_PATH
  ? resolvePath(process.env.CRAFT_PRESENTATION_DB_PATH)
  : resolvePath(import.meta.dirname, '.data/presentations.sqlite');

function readTypecheckStatus(): { status: 'running' | 'passed' | 'failed' } {
  try {
    const value = JSON.parse(readFileSync(typecheckStatusPath, 'utf8')) as { status?: string };
    if (value.status === 'running' || value.status === 'passed' || value.status === 'failed') {
      return { status: value.status };
    }
  } catch {
    // The type-check process may not have written its first status yet.
  }
  return { status: 'running' };
}

function craftTypecheckStatusPlugin() {
  return {
    name: 'craft-typecheck-status',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__craft/typecheck', (_request, response) => {
        response.statusCode = 200;
        response.setHeader('content-type', 'application/json');
        response.setHeader('cache-control', 'no-store');
        response.end(JSON.stringify(readTypecheckStatus()));
      });
    },
  };
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => chunks.push(chunk));
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(chunks.join('')));
      } catch {
        resolve(undefined);
      }
    });
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function readImageUploadInput(value: unknown): PresentationImageUploadInput | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.filename !== 'string' || typeof input.mimeType !== 'string' || typeof input.dataUrl !== 'string') return undefined;
  if (!PRESENTATION_MEDIA_MIME_TYPES.includes(input.mimeType as PresentationMediaMimeType)) return undefined;
  return {
    filename: input.filename,
    mimeType: input.mimeType as PresentationMediaMimeType,
    dataUrl: input.dataUrl,
  };
}

function presentationImagesPlugin() {
  const imageStore = createPresentationImageStore(resolvePath(import.meta.dirname, '.data/presentation-images'));
  return {
    name: 'presentation-images',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const uploadMatch = pathname.match(/^\/api\/presentations\/[^/]+\/images$/);
        const imageMatch = pathname.match(/^\/api\/presentation-images\/([^/]+)$/);

        if (request.method === 'POST' && uploadMatch) {
          void readJsonBody(request).then((body) => {
            const input = readImageUploadInput(body);
            if (!input) {
              sendJson(response, 400, { error: 'A supported image or video is required.' });
              return;
            }
            try {
              sendJson(response, 201, imageStore.save(input));
            } catch (error: unknown) {
              const status = error instanceof PresentationImageError ? 400 : 500;
              sendJson(response, status, { error: error instanceof Error ? error.message : 'Unable to store the media.' });
            }
          });
          return;
        }

        if (request.method === 'GET' && imageMatch?.[1]) {
          const image = imageStore.read(imageMatch[1]);
          if (!image) {
            sendJson(response, 404, { error: 'Media not found.' });
            return;
          }
          response.statusCode = 200;
          response.setHeader('content-type', image.mimeType);
          response.setHeader('cache-control', 'public, max-age=31536000, immutable');
          response.end(image.bytes);
          return;
        }

        next();
      });
    },
  };
}

function presentationApiPlugin() {
  const api = createPresentationApi(presentationDatabasePath);
  return {
    name: 'presentation-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (!pathname.startsWith('/api/presentations')) {
          next();
          return;
        }
        const payload = request.method === 'POST' || request.method === 'PUT'
          ? readJsonBody(request)
          : Promise.resolve(undefined);
        void payload.then((body) => api.handle(request.method ?? 'GET', pathname, body)).then(
          (result) => sendJson(response, result.status, result.body),
          (error: unknown) => sendJson(response, 500, { error: error instanceof Error ? error.message : 'Unexpected backend error.' }),
        );
      });
    },
  };
}

function demoWorkspacePlugin() {
  return {
    name: 'demo-workspaces',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const match = pathname.match(/^\/api\/demo-workspaces\/([^/]+)$/);
        if (request.method !== 'GET' || !match?.[1]) {
          next();
          return;
        }
        const workspaceId = decodeURIComponent(match[1]);
        if (!PRESENTATION_DEMO_WORKSPACES.includes(workspaceId as (typeof PRESENTATION_DEMO_WORKSPACES)[number])) {
          sendJson(response, 404, { error: 'Demo workspace not found.' });
          return;
        }
        try {
          sendJson(response, 200, readDemoWorkspace(workspaceId as (typeof PRESENTATION_DEMO_WORKSPACES)[number]));
        } catch (error: unknown) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : 'Unable to read demo workspace.' });
        }
      });
    },
  };
}



export default defineConfig({
  plugins: [
    craftTypecheckStatusPlugin(),
    presentationImagesPlugin(),
    presentationApiPlugin(),
    demoWorkspacePlugin(),
    // Evaluates every *.style.ts in Node and emits the generated sheet.
    craftStyle({ dumpPath: '.craft/style-graph.json', alias: {
    '@craft-ts/style': resolvePath(import.meta.dirname, 'node_modules/@craft-ts/style/src/index.js')
    } }),

  ],
  server: {
    host: '127.0.0.1',
    port: starterPort,
    forwardConsole: true,
  },
  build: { target: 'es2022' },
});
