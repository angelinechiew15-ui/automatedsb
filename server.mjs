import express from 'express';
import { stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const app = express();
const port = process.env.PORT || 8080;
const apiTarget = process.env.API_TARGET || 'http://automatedsbapi-git:8080';
const browserDistFolder = join(process.cwd(), 'dist', 'automatedsb', 'browser');
const indexHtml = join(browserDistFolder, 'index.html');

app.use('/api', async (req, res) => {
  const target = new URL(req.originalUrl, apiTarget);
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (!value || name.toLowerCase() === 'host') {
      continue;
    }

    headers.set(name, Array.isArray(value) ? value.join(',') : value);
  }

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      duplex: 'half',
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
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(502).json({ error: 'API proxy failed' });
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