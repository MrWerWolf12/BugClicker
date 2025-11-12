class ClickerGame {
  constructor() {
    this.score = 0;
    this.highScore = 0;
    this.level = 1;
    this.basePointsToNextLevel = 10; // Базовое количество очков для 1 уровня
    this.levelMultiplier = 1.5; // Множитель сложности (1.5 = +50% каждый уровень)
    this.clickPower = 1;
    this.achievements = [];
    this.telegramId = null;
    this.userName = 'Гость';
    
    this.initElements();
    this.initTelegram();
  }

  initElements() {
    this.scoreElement = document.getElementById('score');
    this.highScoreElement = document.getElementById('highScore');
    this.levelElement = document.getElementById('level');
    this.progressFill = document.getElementById('progressFill');
    this.progressText = document.getElementById('progressText');
    this.clickable = document.getElementById('clickable');
    this.clickSound = document.getElementById('clickSound');
    this.achievementsContainer = document.getElementById('achievements');
    this.userInfoElement = document.getElementById('userInfo');
  }

  initTelegram() {
    if (window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      webApp.expand();
      
      // Получаем ID пользователя из Telegram
      if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
        this.telegramId = webApp.initDataUnsafe.user.id.toString();
        this.userName = webApp.initDataUnsafe.user.first_name;
        this.updateUserInfo();
        this.loadGame();
      }
    } else {
      // Для тестирования в браузере
      this.telegramId = 'test_user_' + Math.random().toString(36).substr(2, 9);
      this.userName = 'Тестовый пользователь';
      this.updateUserInfo();
      this.loadGame();
    }
  }

  updateUserInfo() {
    if (this.userInfoElement) {
      this.userInfoElement.innerHTML = `
        <div><strong>Игрок:</strong> ${this.userName}</div>
      `;
    }
  }

  // Новый метод для расчета очков до следующего уровня
  getPointsToNextLevel(level) {
    // Экспоненциальный рост: 10, 15, 23, 35, 53, 80, 120...
    return Math.floor(this.basePointsToNextLevel * Math.pow(this.levelMultiplier, level - 1));
  }

  // Новый метод для расчета текущего прогресса
  getCurrentLevelProgress() {
    let totalPointsNeeded = 0;
    
    // Считаем общее количество очков, необходимых для достижения текущего уровня
    for (let i = 1; i < this.level; i++) {
      totalPointsNeeded += this.getPointsToNextLevel(i);
    }
    
    // Текущий прогресс в текущем уровне
    const currentLevelPoints = this.score - totalPointsNeeded;
    const pointsForCurrentLevel = this.getPointsToNextLevel(this.level);
    
    return {
      current: Math.max(0, currentLevelPoints),
      required: pointsForCurrentLevel
    };
  }

  async loadGame() {
    if (!this.telegramId) return;

    try {
      document.body.classList.add('loading');
      
      const response = await fetch(`/api/user/${this.telegramId}`);
      const userData = await response.json();
      
      if (userData) {
        this.score = userData.score || 0;
        this.level = userData.level || 1;
        this.highScore = userData.high_score || 0;
        this.clickPower = this.level;
        this.achievements = JSON.parse(userData.achievements || '[]');
        
        this.updateDisplay();
        this.renderAchievements();
      }
    } catch (error) {
      console.error('Ошибка загрузки игры:', error);
    } finally {
      document.body.classList.remove('loading');
    }
  }

  async saveGame() {
    if (!this.telegramId) return;

    try {
      // Обновляем рекорд если нужно
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }

      const response = await fetch(`/api/user/${this.telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: this.score,
          level: this.level,
          highScore: this.highScore,
          achievements: this.achievements
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('Игра сохранена');
        this.showNotification('💾 Игра сохранена!');
      }
    } catch (error) {
      console.error('Ошибка сохранения игры:', error);
      this.showNotification('❌ Ошибка сохранения');
    }
  }

  showNotification(message, isError = false) {
    // Создаем временное уведомление
    const notification = document.createElement('div');
    notification.className = 'notification';
    if (isError) {
      notification.classList.add('error-notification');
    }
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  handleClick(event) {
    if (!this.telegramId) return;

    // Воспроизвести звук
    this.clickSound.currentTime = 0;
    this.clickSound.play().catch(e => console.log('Звук заблокирован браузером'));

    // Увеличить счет
    this.score += this.clickPower;
    
    // Создать анимацию клика
    this.createClickAnimation(event);
    
    // Проверить уровень
    this.checkLevelUp();
    
    // Проверить достижения
    this.checkAchievements();
    
    // Обновить отображение
    this.updateDisplay();
    
    // Автоматическое сохранение каждые 10 кликов
    if (this.score % 10 === 0) {
      this.saveGame();
    }
  }

  createClickAnimation(event) {
    // Анимация изображения
    this.clickable.classList.add('click-animation');
    setTimeout(() => {
      this.clickable.classList.remove('click-animation');
    }, 300);

    // Создать всплывающее число
    const bonus = document.createElement('div');
    bonus.className = 'bonus';
    bonus.textContent = `+${this.clickPower}`;
    bonus.style.left = (event.clientX - 20) + 'px';
    bonus.style.top = (event.clientY - 20) + 'px';
    document.body.appendChild(bonus);

    // Удалить элемент после анимации
    setTimeout(() => {
      bonus.remove();
    }, 1000);
  }

  checkLevelUp() {
    let currentLevel = 1;
    let totalPointsNeeded = 0;
    
    // Считаем, какой уровень должен быть при текущем количестве очков
    while (true) {
      const pointsForNextLevel = this.getPointsToNextLevel(currentLevel);
      if (totalPointsNeeded + pointsForNextLevel > this.score) {
        break;
      }
      totalPointsNeeded += pointsForNextLevel;
      currentLevel++;
    }
    
    // Если уровень повысился
    if (currentLevel > this.level) {
      const oldLevel = this.level;
      this.level = currentLevel;
      this.clickPower = this.level;
      
      // Анимация повышения уровня
      this.levelElement.parentElement.classList.add('level-up');
      setTimeout(() => {
        this.levelElement.parentElement.classList.remove('level-up');
      }, 1000);
      
      // Показываем сообщения для каждого уровня
      for (let i = oldLevel + 1; i <= this.level; i++) {
        setTimeout(() => {
          this.showLevelUpMessage(i);
        }, (i - oldLevel - 1) * 500);
      }
    }
  }

  showLevelUpMessage(level) {
    const message = document.createElement('div');
    message.className = 'bonus';
    message.textContent = `🎉 Уровень ${level}!`;
    message.style.left = '50%';
    message.style.top = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.fontSize = '2em';
    message.style.color = '#ffd700';
    message.style.zIndex = '1000';
    document.body.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 2000);
  }

  checkAchievements() {
    const achievements = [
      { id: 'first_click', name: 'Первый клик', condition: this.score >= 1 },
      { id: 'ten_clicks', name: '10 очков', condition: this.score >= 10 },
      { id: 'hundred_clicks', name: '100 очков', condition: this.score >= 100 },
      { id: 'thousand_clicks', name: '1000 очков', condition: this.score >= 1000 },
      { id: 'level_5', name: '5 уровень', condition: this.level >= 5 },
      { id: 'level_10', name: '10 уровень', condition: this.level >= 10 },
      { id: 'level_20', name: '20 уровень', condition: this.level >= 20 },
      { id: 'mega_clicker', name: 'Мега кликер', condition: this.clickPower >= 50 }
    ];

    let newAchievements = false;
    
    achievements.forEach(achievement => {
      if (achievement.condition && !this.achievements.includes(achievement.id)) {
        this.achievements.push(achievement.id);
        this.showAchievement(achievement.name);
        newAchievements = true;
      }
    });

    // Сохраняем, если есть новые достижения
    if (newAchievements) {
      this.saveGame();
    }
  }

  showAchievement(name) {
    const achievementElement = document.createElement('div');
    achievementElement.className = 'achievement';
    
    // Специальные достижения с особым оформлением
    if (name.includes('20') || name.includes('Мега')) {
      achievementElement.classList.add('special');
    }
    
    achievementElement.textContent = `🏆 ${name}`;
    this.achievementsContainer.appendChild(achievementElement);

    // Анимация появления
    achievementElement.style.opacity = '0';
    achievementElement.style.transform = 'translateY(20px)';
    setTimeout(() => {
      achievementElement.style.transition = 'all 0.5s ease';
      achievementElement.style.opacity = '1';
      achievementElement.style.transform = 'translateY(0)';
    }, 100);
  }

  renderAchievements() {
    this.achievementsContainer.innerHTML = '<h3>Достижения</h3>';
    const achievementNames = {
      'first_click': 'Первый клик',
      'ten_clicks': '10 очков',
      'hundred_clicks': '100 очков',
      'thousand_clicks': '1000 очков',
      'level_5': '5 уровень',
      'level_10': '10 уровень',
      'level_20': '20 уровень',
      'mega_clicker': 'Мега кликер'
    };

    this.achievements.forEach(id => {
      if (achievementNames[id]) {
        const achievementElement = document.createElement('div');
        achievementElement.className = 'achievement';
        
        if (id === 'level_20' || id === 'mega_clicker') {
          achievementElement.classList.add('special');
        }
        
        achievementElement.textContent = `🏆 ${achievementNames[id]}`;
        this.achievementsContainer.appendChild(achievementElement);
      }
    });
  }

  updateDisplay() {
    this.scoreElement.textContent = this.score;
    this.highScoreElement.textContent = this.highScore;
    this.levelElement.textContent = this.level;
    
    const progress = this.getCurrentLevelProgress();
    const percentage = (progress.current / progress.required) * 100;
    
    this.progressFill.style.width = Math.min(100, percentage) + '%';
    
    // Добавляем специальный класс для высоких уровней
    if (this.level >= 10) {
      this.progressFill.parentElement.classList.add('high-level');
    } else {
      this.progressFill.parentElement.classList.remove('high-level');
    }
    
    // Добавляем специальный класс для максимального изображения
    if (this.level >= 20) {
      this.clickable.classList.add('max-level');
    } else {
      this.clickable.classList.remove('max-level');
    }
    
    this.progressText.textContent = `${progress.current} / ${progress.required} очков до следующего уровня`;
  }
}

// Инициализация игры
const game = new ClickerGame();

// Глобальные функции для обработки кликов
function handleClick(event) {
  game.handleClick(event);
}

function saveGame() {
  game.saveGame();
}

function loadGame() {
  game.loadGame();
}

// Предзагрузка звука
window.addEventListener('load', () => {
  if (game.clickSound) {
    game.clickSound.load();
  }
});

// Автоматическое сохранение при уходе со страницы
window.addEventListener('beforeunload', () => {
  if (game.telegramId) {
    game.saveGame();
  }
});