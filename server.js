import express from 'express';
import cors from 'cors';
import { pipeline, Readable } from 'stream';

const app = express();
app.use(cors());

function getFetch() {
  if (global.fetch) return global.fetch.bind(global);
  try {
    // eslint-disable-next-line global-require
    const nodeFetch = require('node-fetch');
    return nodeFetch;
  } catch (err) {
    throw new Error('No global fetch available. Install node-fetch or use Node 18+.');
  }
}

const fetch = getFetch();

app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url');

  try {
    const resp = await fetch(url);
    res.status(resp.status);
    // copy headers except hop-by-hop ones
    for (const [k, v] of resp.headers) {
      const key = k.toLowerCase();
      if (['transfer-encoding', 'connection'].includes(key)) continue;
      res.set(k, v);
    }

    let body = resp.body;
    // convert Web ReadableStream to Node stream if needed
    if (body && typeof body.pipe !== 'function' && typeof Readable.fromWeb === 'function' && body.getReader) {
      body = Readable.fromWeb(body);
    }

    if (body) {
      pipeline(body, res, (err) => {
        if (err) console.error('proxy stream error', err);
      });
    } else {
      // fall back to buffer
      const buf = await resp.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error('proxy error', err);
    res.status(502).send('proxy error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`proxy listening on http://localhost:${PORT}`));
