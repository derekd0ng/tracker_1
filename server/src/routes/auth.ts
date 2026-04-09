import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const ACCESS_EXPIRES  = '15m';
const REFRESH_DAYS    = 7;

function makeAccessToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_EXPIRES });
}

function makeRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setRefreshCookie(res: any, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(token), expiresAt],
  );
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)       return res.status(400).json({ error: 'Email and password required' }) as any;
    if (password.length < 8)       return res.status(400).json({ error: 'Password must be at least 8 characters' }) as any;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0)  return res.status(409).json({ error: 'Email already registered' }) as any;

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, name',
      [email.toLowerCase(), passwordHash],
    );
    const user = rows[0];

    const accessToken  = makeAccessToken(user.id);
    const refreshToken = makeRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name ?? null } });
  } catch (err) {
    console.error('register:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' }) as any;

    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name FROM users WHERE email = $1',
      [email.toLowerCase()],
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' }) as any;

    const user  = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' }) as any;

    const accessToken  = makeAccessToken(user.id);
    const refreshToken = makeRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);

    res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name ?? null } });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' }) as any;

    const { rows } = await pool.query(
      `SELECT rt.user_id, rt.expires_at, rt.token_hash, u.email, u.name
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [hashToken(token)],
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid refresh token' }) as any;

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [row.token_hash]);
      return res.status(401).json({ error: 'Refresh token expired' }) as any;
    }

    // Rotate refresh token
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [row.token_hash]);
    const newRefreshToken = makeRefreshToken();
    await storeRefreshToken(row.user_id, newRefreshToken);
    setRefreshCookie(res, newRefreshToken);

    const accessToken = makeAccessToken(row.user_id);
    res.json({ accessToken, user: { id: row.user_id, email: row.email, name: row.name ?? null } });
  } catch (err) {
    console.error('refresh:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ ok: true });
  } catch (err) {
    console.error('logout:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' }) as any;
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('me:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/auth/me ────────────────────────────────────────────────────────
router.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const { rows } = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name',
      [name?.trim() || null, req.userId],
    );
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('update me:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
