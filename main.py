import os
from flask import Flask, request, jsonify, render_template_string
import telebot
from telebot import types
import json
import threading
import time
import base64

# Конфигурация
TOKEN = os.environ.get('TELEGRAM_TOKEN')
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')
PORT = int(os.environ.get('PORT', 5000))

# Инициализация Flask и Telegram бота
app = Flask(__name__)
bot = telebot.TeleBot(TOKEN)

# Хранилище данных пользователей
users_data = {}

# Загрузка данных из файла
def load_data():
    global users_data
    try:
        with open('users_data.json', 'r') as f:
            users_data = json.load(f)
    except FileNotFoundError:
        users_data = {}

# Сохранение данных в файл
def save_data():
    with open('users_data.json', 'w') as f:
        json.dump(users_data, f)

# Инициализация данных при запуске
load_data()

# Функция для получения данных пользователя
def get_user_data(user_id):
    user_id = str(user_id)
    if user_id not in users_data:
        users_data[user_id] = {
            'clicks': 0,
            'level': 1,
            'click_power': 1,
            'auto_clickers': 0,
            'total_clicks': 0
        }
        save_data()
    return users_data[user_id]

# HTML шаблон с картинками
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Кликер Игра</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            color: white;
        }
        .game-container {
            max-width: 500px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 20px;
            backdrop-filter: blur(10px);
        }
        .stats {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .click-area {
            margin: 30px 0;
        }
        .click-button {
            width: 150px;
            height: 150px;
            border: none;
            border-radius: 50%;
            background: transparent;
            cursor: pointer;
            transition: transform 0.1s;
            padding: 0;
        }
        .click-button:active {
            transform: scale(0.95);
        }
        .click-button img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
        }
        .shop {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }
        .shop-item {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            padding: 15px;
            width: 120px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .shop-item:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.3);
        }
        .shop-item img {
            width: 60px;
            height: 60px;
            margin-bottom: 10px;
        }
        .counter {
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0;
        }
        .particles {
            position: fixed;
            pointer-events: none;
            z-index: 1000;
        }
        .particle {
            position: absolute;
            font-size: 20px;
            animation: float 1s ease-out forwards;
        }
        @keyframes float {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-100px) scale(0.5); opacity: 0; }
        }
    </style>
</head>
<body>
    <div class="game-container">
        <h1>🐞 Кликер Игра</h1>
        
        <div class="stats">
            <div>Очки: <span id="clicks">{{ clicks }}</span></div>
            <div>Уровень: <span id="level">{{ level }}</span></div>
            <div>Сила клика: <span id="power">{{ click_power }}</span></div>
            <div>Автокликеры: <span id="auto">{{ auto_clickers }}</span></div>
        </div>
        
        <div class="counter">
            +<span id="click-power">{{ click_power }}</span> за клик
        </div>
        
        <div class="click-area">
            <button class="click-button" onclick="clickButton()" id="clickButton">
                <img src="https://cdn-icons-png.flaticon.com/512/1998/1998627.png" alt="Божья коровка">
            </button>
        </div>
        
        <div class="shop">
            <div class="shop-item" onclick="buyItem('power')">
                <img src="https://cdn-icons-png.flaticon.com/512/754/754736.png" alt="Улучшение">
                <div>Улучшить клик</div>
                <div>50 очков</div>
            </div>
            
            <div class="shop-item" onclick="buyItem('auto')">
                <img src="https://cdn-icons-png.flaticon.com/512/2920/2920403.png" alt="Автокликер">
                <div>Автокликер</div>
                <div>200 очков</div>
            </div>
            
            <div class="shop-item" onclick="buyItem('bonus')">
                <img src="https://cdn-icons-png.flaticon.com/512/4315/4315581.png" alt="Бонус">
                <div>Бонус +10</div>
                <div>100 очков</div>
            </div>
        </div>
    </div>

    <div id="particles" class="particles"></div>

    <script>
        let userId = "{{ user_id }}";
        let clicks = {{ clicks }};
        let clickPower = {{ click_power }};
        
        function updateDisplay() {
            document.getElementById('clicks').textContent = clicks;
            document.getElementById('click-power').textContent = clickPower;
            document.getElementById('level').textContent = Math.floor(clicks / 100) + 1;
        }
        
        function clickButton() {
            clicks += clickPower;
            updateDisplay();
            
            // Анимация частиц
            createParticle();
            
            // Отправка данных на сервер
            fetch('/api/click/' + userId, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({clicks: clicks, click_power: clickPower})
            });
        }
        
        function buyItem(type) {
            let cost = 0;
            if (type === 'power') cost = 50;
            else if (type === 'auto') cost = 200;
            else if (type === 'bonus') cost = 100;
            
            if (clicks >= cost) {
                clicks -= cost;
                if (type === 'power') clickPower += 1;
                else if (type === 'bonus') clicks += 10;
                updateDisplay();
                
                fetch('/api/buy/' + userId + '/' + type, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({clicks: clicks, click_power: clickPower})
                });
            } else {
                alert('Недостаточно очков!');
            }
        }
        
        function createParticle() {
            const particles = document.getElementById('particles');
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.innerHTML = '+' + clickPower;
            particle.style.left = (Math.random() * 100) + 'px';
            particle.style.top = (Math.random() * 100) + 'px';
            particles.appendChild(particle);
            
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
        
        // Автоматическое обновление данных
        setInterval(() => {
            fetch('/api/user/' + userId)
                .then(response => response.json())
                .then(data => {
                    clicks = data.clicks;
                    clickPower = data.click_power;
                    updateDisplay();
                });
        }, 5000);
    </script>
</body>
</html>
'''

# Обработчик команды /start
@bot.message_handler(commands=['start'])
def send_welcome(message):
    user_data = get_user_data(message.from_user.id)
    
    # Кнопка для открытия веб-приложения
    markup = types.InlineKeyboardMarkup()
    web_app_btn = types.InlineKeyboardButton(
        '🎮 Играть в Кликер!', 
        web_app=types.WebAppInfo(url=f"{WEBHOOK_URL}/game/{message.from_user.id}")
    )
    stats_btn = types.InlineKeyboardButton('📊 Статистика', callback_data=f'stats_{message.from_user.id}')
    
    markup.add(web_app_btn)
    markup.add(stats_btn)
    
    welcome_text = f"""🎉 Добро пожаловать в Кликер Бот!

Нажмите кнопку ниже, чтобы начать играть!
У вас уже есть {user_data['clicks']} очков."""

    bot.send_message(message.chat.id, welcome_text, reply_markup=markup)

# Обработчик callback кнопок
@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    if call.data.startswith('stats_'):
        user_id = call.data.split('_')[1]
        user_data = get_user_data(user_id)
        
        stats_text = f"""📊 Ваша статистика:

Очки: {user_data['clicks']}
Уровень: {user_data['level']}
Сила клика: {user_data['click_power']}
Автокликеры: {user_data['auto_clickers']}
Всего кликов: {user_data['total_clicks']}"""

        markup = types.InlineKeyboardMarkup()
        web_app_btn = types.InlineKeyboardButton(
            '🎮 Продолжить играть!', 
            web_app=types.WebAppInfo(url=f"{WEBHOOK_URL}/game/{user_id}")
        )
        markup.add(web_app_btn)
        
        bot.edit_message_text(
            chat_id=call.message.chat.id,
            message_id=call.message.message_id,
            text=stats_text,
            reply_markup=markup
        )
        bot.answer_callback_query(call.id)

# Flask маршруты
@app.route('/')
def index():
    return jsonify({"message": "Telegram Clicker Bot is running!"})

@app.route('/game/<user_id>')
def game(user_id):
    user_data = get_user_data(user_id)
    return render_template_string(HTML_TEMPLATE, 
                                user_id=user_id,
                                clicks=user_data['clicks'],
                                level=user_data['level'],
                                click_power=user_data['click_power'],
                                auto_clickers=user_data['auto_clickers'])

@app.route('/api/user/<user_id>')
def get_user(user_id):
    user_data = get_user_data(user_id)
    return jsonify(user_data)

@app.route('/api/click/<user_id>', methods=['POST'])
def click(user_id):
    user_data = get_user_data(user_id)
    data = request.json
    user_data['clicks'] = data['clicks']
    user_data['click_power'] = data['click_power']
    user_data['total_clicks'] += 1
    user_data['level'] = data['clicks'] // 100 + 1
    save_data()
    return jsonify({"status": "ok"})

@app.route('/api/buy/<user_id>/<item_type>', methods=['POST'])
def buy_item(user_id, item_type):
    user_data = get_user_data(user_id)
    data = request.json
    user_data['clicks'] = data['clicks']
    user_data['click_power'] = data['click_power']
    
    if item_type == 'power':
        pass  # Уже обработано на клиенте
    elif item_type == 'auto':
        user_data['auto_clickers'] += 1
    elif item_type == 'bonus':
        pass  # Уже обработано на клиенте
    
    save_data()
    return jsonify({"status": "ok"})

@app.route('/webhook', methods=['POST'])
def webhook():
    json_str = request.get_data().decode('utf-8')
    update = telebot.types.Message.de_json(json_str)
    bot.process_new_updates([telebot.types.MessageUpdate(update)])
    return 'ok', 200

@app.route('/set_webhook')
def set_webhook():
    webhook_url = f"{WEBHOOK_URL}/webhook"
    bot.remove_webhook()
    bot.set_webhook(url=webhook_url)
    return f"Webhook set to {webhook_url}"

# Автокликеры
def auto_clicker_worker():
    while True:
        time.sleep(10)  # Каждые 10 секунд
        for user_id, user_data in list(users_data.items()):
            if user_data['auto_clickers'] > 0:
                user_data['clicks'] += user_data['auto_clickers']
        save_data()

if __name__ == '__main__':
    # Запуск потока для автокликеров
    auto_clicker_thread = threading.Thread(target=auto_clicker_worker, daemon=True)
    auto_clicker_thread.start()
    
    # Запуск Flask приложения
    app.run(host='0.0.0.0', port=PORT, debug=False)