// In-memory stand-in for the MongoDB collections (CheckinLog, Token).
// Swap this for real MongoDB queries once you have a live DB connection;
// the query shape (group by date, count per slot) stays the same.

let checkins = [];
let tokens = [];

function resetStore() {
  checkins = [];
  tokens = [];
}

function addCheckin({ slot, date, timestamp }) {
  checkins.push({ slot, date, timestamp });
}

function getCheckinCountsBySlot(slot, sinceDate) {
  const relevant = checkins.filter(c => c.slot === slot && c.date >= sinceDate);
  const byDate = {};
  for (const c of relevant) {
    byDate[c.date] = (byDate[c.date] || 0) + 1;
  }
  return Object.entries(byDate).map(([date, count]) => ({ date, count }));
}

function countActiveTokens(slot) {
  return tokens.filter(t => t.slot === slot && t.status === 'active').length;
}

function createToken({ studentId, slot, position }) {
  const token = {
    tokenId: `TKN-${tokens.length + 1}`,
    studentId,
    slot,
    position,
    status: 'active',
    issuedAt: new Date().toISOString()
  };
  tokens.push(token);
  return token;
}

function allTokens() {
  return tokens;
}

module.exports = {
  resetStore,
  addCheckin,
  getCheckinCountsBySlot,
  countActiveTokens,
  createToken,
  allTokens
};
