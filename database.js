const { Pool } = require('pg');
const path = require('path');

// Используем DATABASE_URL из environment variables (Render автоматически предоставляет)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Создаем таблицу при запуске
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id TEXT UNIQUE NOT NULL,
        score INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        high_score INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        upgrades TEXT DEFAULT '{}',
        achievements TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем индекс для быстрого поиска
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_id)
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

initializeDatabase();

class Database {
  static async getUser(telegramId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  static async createUser(telegramId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO users (telegram_id) 
         VALUES ($1) 
         ON CONFLICT (telegram_id) 
         DO NOTHING 
         RETURNING *`,
        [telegramId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        // Если пользователь уже существует, возвращаем его
        const existingUser = await this.getUser(telegramId);
        return existingUser;
      }
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateUser(telegramId, data) {
    const client = await pool.connect();
    try {
      const { score, level, highScore, coins, upgrades, achievements } = data;
      const result = await client.query(
        `UPDATE users SET 
         score = $1, level = $2, high_score = $3, coins = $4, 
         upgrades = $5, achievements = $6, last_updated = CURRENT_TIMESTAMP 
         WHERE telegram_id = $7`,
        [score, level, highScore, coins || 0, JSON.stringify(upgrades || {}), JSON.stringify(achievements), telegramId]
      );
      return result.rowCount;
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTopPlayers(limit = 10) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT telegram_id, high_score, level, coins FROM users ORDER BY high_score DESC LIMIT $1',
        [limit]
      );
      return result.rows;
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { Database, pool };