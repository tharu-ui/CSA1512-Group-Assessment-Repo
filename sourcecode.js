// src/routes/canteen.js
const express = require('express');
const router = express.Router();
const CheckinLog = require('../models/CheckinLog');
const Token = require('../models/Token');

const SLOT_CAPACITY = 60;

function mapLevelToWaitMinutes(level) {
  if (level === 'High') return 15;
  if (level === 'Medium') return 8;
  return 3;
}

async function predictCrowdLevel(slot) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const history = await CheckinLog.aggregate([
    { $match: { slot, timestamp: { $gte: sevenDaysAgo } } },
    { $group: { _id: '$date', count: { $sum: 1 } } }
  ]);

  if (history.length < 3) {
    return { slot, level: 'Medium', expectedWaitMins: mapLevelToWaitMinutes('Medium'), note: 'fallback: insufficient history' };
  }

  const avgCount = history.reduce((sum, d) => sum + d.count, 0) / history.length;
  let level = 'Low';
  if (avgCount > SLOT_CAPACITY * 0.8) level = 'High';
  else if (avgCount > SLOT_CAPACITY * 0.4) level = 'Medium';

  return { slot, level, expectedWaitMins: mapLevelToWaitMinutes(level) };
}

router.get('/prediction', async (req, res) => {
  try {
    const slots = ['11:30', '12:30', '13:30'];
    const predictions = await Promise.all(slots.map(predictCrowdLevel));
    res.status(200).json(predictions);
  } catch (err) {
    res.status(500).json({ error: 'Prediction failed', details: err.message });
  }
});

router.post('/token', async (req, res) => {
  try {
    const { studentId, slot } = req.body;
    if (!studentId || !slot) return res.status(400).json({ error: 'studentId and slot required' });

    const activeCount = await Token.countDocuments({ slot, status: 'active' });
    if (activeCount >= SLOT_CAPACITY) {
      return res.status(409).json({ error: 'SLOT_FULL' });
    }

    const token = await Token.create({
      studentId, slot, position: activeCount + 1, status: 'active'
    });
    res.status(201).json(token);
  } catch (err) {
    res.status(400).json({ error: 'Token issuance failed', details: err.message });
  }
});

module.exports = router;

