class ClickerGame {
  constructor() {
    this.score = 0;
    this.highScore = this.getHighScore();
    this.level = 1;
    this.pointsToNextLevel = 10;
    this.clickPower = 1;
    this.achievements = [];
    
    this.initElements();
    this.updateDisplay();
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
  }

  getHighScore() {
    return parseInt(localStorage.getItem('clickerHighScore')) || 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('clickerHighScore', this.highScore.toString());
      this.highScoreElement.textContent = this.highScore;
    }
  }

  handleClick(event) {
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
    
    // Сохранить рекорд
    this.saveHighScore();
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
    const progress = (this.score % this.pointsToNextLevel) / this.pointsToNextLevel * 100;
    const currentLevel = Math.floor(this.score / this.pointsToNextLevel) + 1;
    
    if (currentLevel > this.level) {
      this.level = currentLevel;
      this.clickPower = this.level;
      
      // Анимация повышения уровня
      this.levelElement.parentElement.classList.add('level-up');
      setTimeout(() => {
        this.levelElement.parentElement.classList.remove('level-up');
      }, 1000);
      
      this.showLevelUpMessage();
    }
  }

  showLevelUpMessage() {
    const message = document.createElement('div');
    message.className = 'bonus';
    message.textContent = `🎉 Уровень ${this.level}!`;
    message.style.left = '50%';
    message.style.top = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.fontSize = '2em';
    message.style.color = '#ffd700';
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
      { id: 'level_10', name: '10 уровень', condition: this.level >= 10 }
    ];

    achievements.forEach(achievement => {
      if (achievement.condition && !this.achievements.includes(achievement.id)) {
        this.achievements.push(achievement.id);
        this.showAchievement(achievement.name);
      }
    });
  }

  showAchievement(name) {
    const achievementElement = document.createElement('div');
    achievementElement.className = 'achievement';
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

  updateDisplay() {
    this.scoreElement.textContent = this.score;
    this.highScoreElement.textContent = this.highScore;
    this.levelElement.textContent = this.level;
    
    const progress = (this.score % this.pointsToNextLevel) / this.pointsToNextLevel * 100;
    this.progressFill.style.width = progress + '%';
    
    const nextLevelPoints = this.level * this.pointsToNextLevel;
    const currentProgress = this.score % this.pointsToNextLevel;
    this.progressText.textContent = `${currentProgress} / ${this.pointsToNextLevel} очков до следующего уровня`;
  }
}

// Инициализация игры
const game = new ClickerGame();

// Глобальная функция для обработки кликов
function handleClick(event) {
  game.handleClick(event);
}

// Предзагрузка звука
window.addEventListener('load', () => {
  game.clickSound.load();
});