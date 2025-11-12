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
    // Создаем таблицу с дополнительным полем username
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id TEXT UNIQUE NOT NULL,
        username TEXT,
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

  static async createUser(telegramId, username = null) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO users (telegram_id, username) 
         VALUES ($1, $2) 
         ON CONFLICT (telegram_id) 
         DO NOTHING 
         RETURNING *`,
        [telegramId, username || null]
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
      const { score, level, highScore, coins, upgrades, achievements, username } = data;
      const result = await client.query(
        `UPDATE users SET 
         score = $1, level = $2, high_score = $3, coins = $4, 
         upgrades = $5, achievements = $6, username = $7, last_updated = CURRENT_TIMESTAMP 
         WHERE telegram_id = $8`,
        [score, level, highScore, coins || 0, JSON.stringify(upgrades || {}), JSON.stringify(achievements), username || null, telegramId]
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
        `SELECT telegram_id, high_score, level, coins, username
         FROM users 
         ORDER BY high_score DESC 
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  // Новый метод для получения ранга пользователя
  static async getUserRank(telegramId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) + 1 as rank 
         FROM users 
         WHERE high_score > (SELECT high_score FROM users WHERE telegram_id = $1)`,
        [telegramId]
      );
      return parseInt(result.rows[0].rank);
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { Database, pool };