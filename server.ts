import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, getUsers } from './src/db/users.ts';
import { resolveUndersizedAlbumsWithAI } from './src/server/geminiAlbumResolver.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Auto AI Discography Album Resolver: Suggests master albums for releases with < 3 songs
  app.post('/api/ai/suggest-album-merges', async (req, res) => {
    try {
      const { candidates } = req.body;
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.json({ suggestions: [] });
      }

      const suggestions = await resolveUndersizedAlbumsWithAI(candidates);
      res.json({ suggestions });
    } catch (error: any) {
      console.error('Failed to resolve album merges via AI:', error);
      res.status(500).json({ error: error.message || 'AI album resolution failed' });
    }
  });

  // User synchronization & retrieval with Firebase ID Token
  app.get('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || '';
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: No UID found' });
      }

      const user = await getOrCreateUser(uid, email);
      res.json({ user });
    } catch (error: any) {
      console.error('Failed to sync or retrieve user:', error);
      res.status(500).json({ error: error.message || 'Failed to process user' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
