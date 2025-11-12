const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'clicker.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE,
    score INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    high_score INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    upgrades TEXT DEFAULT '{}',
    achievements TEXT DEFAULT '[]',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

class Database {
  static async getUser(telegramId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE telegram_id = ?',
        [telegramId],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });
  }

  static async createUser(telegramId) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO users (telegram_id) VALUES (?)',
        [telegramId],
        function(err) {
          if (err) reject(err);
          resolve({ 
            id: this.lastID, 
            telegram_id: telegramId, 
            score: 0, 
            level: 1, 
            high_score: 0, 
            coins: 0,
            upgrades: '{}',
            achievements: '[]' 
          });
        }
      );
    });
  }

  static async updateUser(telegramId, data) {
    return new Promise((resolve, reject) => {
      const { score, level, highScore, coins, upgrades, achievements } = data;
      db.run(
        `UPDATE users SET 
         score = ?, level = ?, high_score = ?, coins = ?, upgrades = ?, achievements = ?, last_updated = CURRENT_TIMESTAMP 
         WHERE telegram_id = ?`,
        [score, level, highScore, coins || 0, JSON.stringify(upgrades || {}), JSON.stringify(achievements), telegramId],
        function(err) {
          if (err) reject(err);
          resolve(this.changes);
        }
      );
    });
  }

  static async getTopPlayers(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT telegram_id, high_score, level, coins FROM users ORDER BY high_score DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
  }
}

module.exports = { Database, db };