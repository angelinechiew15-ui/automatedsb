import express from 'express';
import { stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const app = express();
const port = process.env.PORT || 8080;
const apiTarget = process.env.API_TARGET || 'http://automatedsbapi-git:8080';
const browserDistFolder = join(process.cwd(), 'dist', 'automatedsb', 'browser');
const indexHtml = join(browserDistFolder, 'index.html');

// Connection-level errors that are safe to retry. These happen when the API
// pod is restarting / not yet ready (rolling deploys, cold starts) — the
// request never reached the server, so retrying does not risk duplicate work.
const RETRYABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);
const PROXY_MAX_ATTEMPTS = Number(process.env.API_PROXY_RETRIES || 4);
const PROXY_RETRY_DELAY_MS = Number(process.env.API_PROXY_RETRY_DELAY_MS || 300);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Collect a readable request stream into a single Buffer (small JSON bodies). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

app.use('/api', async (req, res) => {
  const target = new URL(req.originalUrl, apiTarget);
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (!value || name.toLowerCase() === 'host') {
      continue;
    }

    headers.set(name, Array.isArray(value) ? value.join(',') : value);
  }

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  // Buffer the body once so the request can be safely retried.
  const body = hasBody ? await readBody(req) : undefined;

  let lastError;
  for (let attempt = 1; attempt <= PROXY_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(target, {
        method: req.method,
        headers,
        body,
      });

      res.status(response.status);
      response.headers.forEach((value, name) => res.setHeader(name, value));

      if (response.body) {
        await response.body.pipeTo(
          new WritableStream({
            write(chunk) {
              res.write(chunk);
            },
            close() {
              res.end();
            },
            abort(error) {
              res.destroy(error);
            },
          }),
        );
      } else {
        res.end();
      }
      return;
    } catch (error) {
      lastError = error;
      const code = error?.cause?.code ?? error?.code;
      const retryable = RETRYABLE_CODES.has(code);

      console.error(
        `API proxy error (attempt ${attempt}/${PROXY_MAX_ATTEMPTS}) ` +
          `${req.method} ${req.originalUrl} -> ${target.href}: ` +
          `${code ?? error?.message ?? 'unknown error'}`,
      );

      if (!retryable || attempt === PROXY_MAX_ATTEMPTS) {
        break;
      }
      // Exponential backoff: gives the API pod time to become ready.
      await sleep(PROXY_RETRY_DELAY_MS * attempt);
    }
  }

  if (!res.headersSent) {
    const code = lastError?.cause?.code ?? lastError?.code;
    res.status(502).json({
      error: 'API proxy failed',
      code: code ?? null,
      target: target.href,
    });
  }
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use(async (req, res, next) => {
  try {
    const requestedPath = join(browserDistFolder, req.path);

    if (extname(req.path) && !(await exists(requestedPath))) {
      res.sendStatus(404);
      return;
    }

    res.sendFile(indexHtml);
  } catch (error) {
    next(error);
  }
});

app.listen(port, () => {
  console.log(`Angular app listening on http://localhost:${port}`);
  console.log(`Proxying /api to ${apiTarget}`);
});

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}