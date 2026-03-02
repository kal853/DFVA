import { z } from 'zod';
import { insertUserSchema, users } from './schema';

export const errorSchemas = {
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  tools: {
    searchUsers: {
      method: 'GET' as const,
      path: '/api/search' as const,
      responses: {
        200: z.array(z.any()),
        500: errorSchemas.internal,
      },
    },
    ping: {
      method: 'POST' as const,
      path: '/api/ping' as const,
      input: z.object({ host: z.string() }),
      responses: {
        200: z.object({ output: z.string() }),
        500: errorSchemas.internal,
      },
    },
    fetchUrl: {
      method: 'POST' as const,
      path: '/api/fetch' as const,
      input: z.object({ url: z.string() }),
      responses: {
        200: z.object({ data: z.string() }),
        500: errorSchemas.internal,
      },
    },
    readLog: {
      method: 'GET' as const,
      path: '/api/files' as const,
      responses: {
        200: z.object({ content: z.string() }),
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
