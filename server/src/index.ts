import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

import authRouter       from './routes/auth';
import medicationsRouter from './routes/medications';
import habitsRouter     from './routes/habits';
import wellbeingRouter  from './routes/wellbeing';
import telegramRouter, { registerBotCommands } from './routes/telegram';
import { startMedicationReminders } from './jobs/medicationReminders';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, etc.)
    if (!origin) return cb(null, true);
    // Allow localhost in dev
    if (origin.startsWith('http://localhost')) return cb(null, true);
    // Allow any Vercel deployment (including preview URLs)
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    // Allow explicitly configured frontend URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/habits',      habitsRouter);
app.use('/api/wellbeing',   wellbeingRouter);
app.use('/api/telegram',    telegramRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startMedicationReminders();
  registerBotCommands();
});
