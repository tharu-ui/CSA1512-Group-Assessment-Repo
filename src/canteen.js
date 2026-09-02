const express = require('express');
const router = express.Router();
const store = require('./store');

const SLOT_CAPACITY = 60;
const HISTORY_WINDOW_DAYS = 7;

function mapLevelToWaitMinutes(level) {
  if (level === 'High') return 15;
  if (level === 'Medium') return 8;
  return 3;
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function predictCrowdLevel(slot) {
  const sinceDate = dateNDaysAgo(HISTORY_WINDOW_DAYS);
  const history = store.getCheckinCountsBySlot(slot, sinceDate);

  if (history.length < 3) {
    return {
      slot,
      level: 'Medium',
      expectedWaitMins: mapLevelToWaitMinutes('Medium'),
      note: 'fallback: insufficient history (' + history.length + ' day(s) of data)'
    };
  }

  const avgCount = history.reduce((sum, d) => sum + d.count, 0) / history.length;
  let level = 'Low';
  if (avgCount > SLOT_CAPACITY * 0.8) level = 'High';
  else if (avgCount > SLOT_CAPACITY * 0.4) level = 'Medium';

  return { slot, level, expectedWaitMins: mapLevelToWaitMinutes(level), avgCount };
}

router.get('/prediction', (req, res) => {
  try {
    const slots = ['11:30', '12:30', '13:30'];
    const predictions = slots.map(predictCrowdLevel);
    res.status(200).json(predictions);
  } catch (err) {
    res.status(500).json({ error: 'Prediction failed', details: err.message });
  }
});

router.post('/checkin', (req, res) => {
  const { slot, date, timestamp } = req.body;
  if (!slot || !date) return res.status(400).json({ error: 'slot and date required' });
  store.addCheckin({ slot, date, timestamp: timestamp || new Date().toISOString() });
  res.status(201).json({ status: 'logged' });
});

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  next();
}

router.post('/token', requireAuth, (req, res) => {
  try {
    const { studentId, slot } = req.body;
    if (!studentId || !slot) return res.status(400).json({ error: 'studentId and slot required' });

    const activeCount = store.countActiveTokens(slot);
    if (activeCount >= SLOT_CAPACITY) {
      return res.status(409).json({ error: 'SLOT_FULL' });
    }

    const token = store.createToken({ studentId, slot, position: activeCount + 1 });
    res.status(201).json(token);
  } catch (err) {
    res.status(400).json({ error: 'Token issuance failed', details: err.message });
  }
});

module.exports = router;
