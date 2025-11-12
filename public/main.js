class ClickerGame {
  constructor() {
    this.score = 0;
    this.highScore = 0;
    this.level = 1;
    this.basePointsToNextLevel = 10;
    this.levelMultiplier = 1.5;
    this.clickPower = 1;
    this.coins = 0;
    this.achievements = [];
    this.telegramId = null;
    this.userName = 'Гость';
    
    this.upgrades = {
      yandexSearch: { level: 0, cost: 50, multiplier: 1 },
      yandexMaps: { level: 0, cost: 100, multiplier: 2 },
      yandexMusic: { level: 0, cost: 200, multiplier: 3 },
      yandexPlus: { level: 0, cost: 500, multiplier: 5 },
      yandexGPT: { level: 0, cost: 1000, multiplier: 10 },
      yandexCloud: { level: 0, cost: 2000, multiplier: 15 },
      yandexMarket: { level: 0, cost: 5000, multiplier: 25 },
      yandexGo: { level: 0, cost: 10000, multiplier: 50 }
    };
    
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
    this.coinsElement = document.getElementById('coins');
  }

  initTelegram() {
    if (window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      webApp.expand();
      
      if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
        this.telegramId = webApp.initDataUnsafe.user.id.toString();
        this.userName = webApp.initDataUnsafe.user.first_name;
        this.updateUserInfo();
        this.loadGame();
      }
    } else {
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

  getPointsToNextLevel(level) {
    return Math.floor(this.basePointsToNextLevel * Math.pow(this.levelMultiplier, level - 1));
  }

  getCurrentLevelProgress() {
    let totalPointsNeeded = 0;
    
    for (let i = 1; i < this.level; i++) {
      totalPointsNeeded += this.getPointsToNextLevel(i);
    }
    
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
        this.coins = userData.coins || 0;
        
        if (userData.upgrades) {
          const savedUpgrades = JSON.parse(userData.upgrades || '{}');
          Object.keys(savedUpgrades).forEach(key => {
            if (this.upgrades[key]) {
              this.upgrades[key] = savedUpgrades[key];
            }
          });
        }
        
        this.clickPower = this.calculateClickPower();
        this.achievements = JSON.parse(userData.achievements || '[]');
        
        setTimeout(() => {
          this.updateDisplay();
          this.renderAchievements();
          this.renderUpgrades();
        }, 100);
      }
    } catch (error) {
      console.error('Ошибка загрузки игры:', error);
    } finally {
      setTimeout(() => {
        document.body.classList.remove('loading');
      }, 500);
    }
  }

  async saveGame() {
    if (!this.telegramId) return;

    try {
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
          coins: this.coins,
          upgrades: this.upgrades,
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

    this.clickSound.currentTime = 0;
    this.clickSound.play().catch(e => console.log('Звук заблокирован браузером'));

    this.score += this.clickPower;
    this.coins += 1;
    
    this.createClickAnimation(event);
    this.checkLevelUp();
    this.checkAchievements();
    this.updateDisplay();
    
    if (this.score % 10 === 0) {
      this.saveGame();
    }
  }

  createClickAnimation(event) {
    this.clickable.classList.add('click-animation');
    setTimeout(() => {
      this.clickable.classList.remove('click-animation');
    }, 300);

    const bonus = document.createElement('div');
    bonus.className = 'bonus';
    bonus.textContent = `+${this.clickPower}`;
    bonus.style.left = (event.clientX - 20) + 'px';
    bonus.style.top = (event.clientY - 20) + 'px';
    document.body.appendChild(bonus);

    setTimeout(() => {
      bonus.remove();
    }, 1000);
  }

  checkLevelUp() {
    let currentLevel = 1;
    let totalPointsNeeded = 0;
    
    while (true) {
      const pointsForNextLevel = this.getPointsToNextLevel(currentLevel);
      if (totalPointsNeeded + pointsForNextLevel > this.score) {
        break;
      }
      totalPointsNeeded += pointsForNextLevel;
      currentLevel++;
    }
    
    if (currentLevel > this.level) {
      const oldLevel = this.level;
      this.level = currentLevel;
      this.clickPower = this.calculateClickPower();
      
      this.levelElement.parentElement.classList.add('level-up');
      setTimeout(() => {
        this.levelElement.parentElement.classList.remove('level-up');
      }, 1000);
      
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

  calculateClickPower() {
    let power = 1;
    
    Object.values(this.upgrades).forEach(upgrade => {
      power += upgrade.level * upgrade.multiplier;
    });
    
    return Math.max(1, power);
  }

  buyUpgrade(upgradeKey) {
    const upgrade = this.upgrades[upgradeKey];
    const currentCost = Math.floor(upgrade.cost * Math.pow(1.5, upgrade.level));
    
    if (this.coins >= currentCost) {
      this.coins -= currentCost;
      upgrade.level++;
      
      this.clickPower = this.calculateClickPower();
      
      this.updateDisplay();
      this.renderUpgrades();
      this.saveGame();
      
      this.showNotification(`✅ Куплено: ${this.getUpgradeName(upgradeKey)} Уровень ${upgrade.level}!`);
    } else {
      this.showNotification('❌ Недостаточно монет!', true);
    }
  }

  getUpgradeName(key) {
    const names = {
      yandexSearch: 'Яндекс Поиск',
      yandexMaps: 'Яндекс Карты',
      yandexMusic: 'Яндекс Музыка',
      yandexPlus: 'Яндекс Плюс',
      yandexGPT: 'YandexGPT',
      yandexCloud: 'Яндекс Облако',
      yandexMarket: 'Яндекс Маркет',
      yandexGo: 'Яндекс Go'
    };
    return names[key] || key;
  }

  getUpgradeIcon(key) {
    const icons = {
      yandexSearch: '🔍',
      yandexMaps: '🗺️',
      yandexMusic: '🎵',
      yandexPlus: '⭐',
      yandexGPT: '🤖',
      yandexCloud: '☁️',
      yandexMarket: '🛒',
      yandexGo: '🚗'
    };
    return icons[key] || '📦';
  }

  getUpgradeDescription(key) {
    const descriptions = {
      yandexSearch: 'Улучшенный алгоритм поиска',
      yandexMaps: 'Геолокация для точных кликов',
      yandexMusic: 'Музыкальная мотивация',
      yandexPlus: 'Премиум возможности',
      yandexGPT: 'Искусственный интеллект помощи',
      yandexCloud: 'Облачное хранилище кликов',
      yandexMarket: 'Коммерческие улучшения',
      yandexGo: 'Мобильная оптимизация'
    };
    return descriptions[key] || 'Полезное улучшение';
  }

  renderUpgrades() {
    const grid = document.getElementById('upgradesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    Object.keys(this.upgrades).forEach(key => {
      const upgrade = this.upgrades[key];
      const currentCost = Math.floor(upgrade.cost * Math.pow(1.5, upgrade.level));
      const isAvailable = this.coins >= currentCost;
      
      const upgradeElement = document.createElement('div');
      upgradeElement.className = 'upgrade-item';
      if (upgrade.level > 0) {
        upgradeElement.classList.add('purchased');
      }
      if (!isAvailable && upgrade.level === 0) {
        upgradeElement.classList.add('unavailable');
      }
      
      if (key.includes('yandex')) {
        upgradeElement.classList.add('yandex-theme');
      }
      
      upgradeElement.innerHTML = `
        <div class="upgrade-icon">${this.getUpgradeIcon(key)}</div>
        <div class="upgrade-name">${this.getUpgradeName(key)}</div>
        <div class="upgrade-description" style="font-size: 0.7em; color: #666; margin: 3px 0;">
          ${this.getUpgradeDescription(key)}
        </div>
        <div class="upgrade-cost">🟡 ${currentCost}</div>
        ${upgrade.level > 0 ? `<div class="upgrade-level">Уровень: ${upgrade.level}</div>` : ''}
        <div style="font-size: 0.7em; color: #888; margin-top: 3px;">
          +${upgrade.multiplier} к силе
        </div>
      `;
      
      if (isAvailable || upgrade.level > 0) {
        upgradeElement.onclick = () => this.buyUpgrade(key);
      }
      
      grid.appendChild(upgradeElement);
    });
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
      { id: 'mega_clicker', name: 'Мега кликер', condition: this.clickPower >= 50 },
      { id: 'first_upgrade', name: 'Первое улучшение', condition: this.getTotalUpgrades() >= 1 },
      { id: 'upgrade_master', name: 'Мастер улучшений', condition: this.getTotalUpgrades() >= 10 }
    ];

    let newAchievements = false;
    
    achievements.forEach(achievement => {
      if (achievement.condition && !this.achievements.includes(achievement.id)) {
        this.achievements.push(achievement.id);
        this.showAchievement(achievement.name);
        newAchievements = true;
      }
    });

    if (newAchievements) {
      this.saveGame();
    }
  }

  getTotalUpgrades() {
    return Object.values(this.upgrades).reduce((total, upgrade) => total + upgrade.level, 0);
  }

  showAchievement(name) {
    const achievementElement = document.createElement('div');
    achievementElement.className = 'achievement';
    
    if (name.includes('20') || name.includes('Мега') || name.includes('Мастер')) {
      achievementElement.classList.add('special');
    }
    
    achievementElement.textContent = `🏆 ${name}`;
    this.achievementsContainer.appendChild(achievementElement);

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
      'mega_clicker': 'Мега кликер',
      'first_upgrade': 'Первое улучшение',
      'upgrade_master': 'Мастер улучшений'
    };

    this.achievements.forEach(id => {
      if (achievementNames[id]) {
        const achievementElement = document.createElement('div');
        achievementElement.className = 'achievement';
        
        if (id === 'level_20' || id === 'mega_clicker' || id === 'upgrade_master') {
          achievementElement.classList.add('special');
        }
        
        achievementElement.textContent = `🏆 ${achievementNames[id]}`;
        this.achievementsContainer.appendChild(achievementElement);
      }
    });
  }

  updateDisplay() {
    if (this.scoreElement) this.scoreElement.textContent = this.score;
    if (this.highScoreElement) this.highScoreElement.textContent = this.highScore;
    if (this.levelElement) this.levelElement.textContent = this.level;
    if (this.coinsElement) this.coinsElement.textContent = this.coins;
    
    const progress = this.getCurrentLevelProgress();
    const percentage = (progress.current / progress.required) * 100;
    
    if (this.progressFill) {
      this.progressFill.style.width = Math.min(100, percentage) + '%';
    }
    
    if (this.progressFill && this.progressFill.parentElement) {
      if (this.level >= 10) {
        this.progressFill.parentElement.classList.add('high-level');
      } else {
        this.progressFill.parentElement.classList.remove('high-level');
      }
    }
    
    if (this.clickable) {
      if (this.level >= 20) {
        this.clickable.classList.add('max-level');
      } else {
        this.clickable.classList.remove('max-level');
      }
    }
    
    if (this.progressText) {
      this.progressText.textContent = `${progress.current} / ${progress.required} очков до следующего уровня`;
    }
    
    // Обновляем магазин при каждом обновлении
    this.renderUpgrades();
  }
}

const game = new ClickerGame();

function handleClick(event) {
  game.handleClick(event);
}

function saveGame() {
  game.saveGame();
}

function loadGame() {
  game.loadGame();
}

window.addEventListener('load', () => {
  if (game.clickSound) {
    game.clickSound.load();
  }
});

window.addEventListener('beforeunload', () => {
  if (game.telegramId) {
    game.saveGame();
  }
});