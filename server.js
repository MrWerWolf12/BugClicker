const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { Database } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    let user = await Database.getUser(telegramId);
    
    if (!user) {
      user = await Database.createUser(telegramId);
    } else {
      user.achievements = JSON.parse(user.achievements || '[]');
      user.upgrades = JSON.parse(user.upgrades || '{}');
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const userData = req.body;
    
    const result = await Database.updateUser(telegramId, userData);
    res.json({ success: true, changes: result });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const players = await Database.getTopPlayers(10);
    res.json(players);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Новый endpoint для получения ранга пользователя
app.get('/api/user/:telegramId/rank', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const rank = await Database.getUserRank(telegramId);
    res.json({ rank: rank });
  } catch (error) {
    console.error('Error getting user rank:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});