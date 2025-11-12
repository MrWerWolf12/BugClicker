const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { Database } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Получить данные пользователя
app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    let user = await Database.getUser(telegramId);
    
    if (!user) {
      user = await Database.createUser(telegramId);
    } else {
      // Парсим achievements из строки в массив
      user.achievements = JSON.parse(user.achievements || '[]');
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить данные пользователя
app.post('/api/user/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const userData = req.body;
    
    const result = await Database.updateUser(telegramId, userData);
    res.json({ success: true, changes: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить топ игроков
app.get('/api/leaderboard', async (req, res) => {
  try {
    const players = await Database.getTopPlayers(10);
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
