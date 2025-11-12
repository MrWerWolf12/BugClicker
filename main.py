import os
from flask import Flask, request, jsonify
import telebot
from telebot import types
import json
import threading
import time

# Конфигурация
TOKEN = os.environ.get('TELEGRAM_TOKEN')
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')
PORT = int(os.environ.get('PORT', 5000))

# Инициализация Flask и Telegram бота
app = Flask(__name__)
bot = telebot.TeleBot(TOKEN)

# Хранилище данных пользователей (в реальном приложении используйте базу данных)
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
            'auto_clickers': 0
        }
        save_data()
    return users_data[user_id]

# Обработчик команды /start
@bot.message_handler(commands=['start'])
def send_welcome(message):
    user_data = get_user_data(message.from_user.id)
    
    markup = types.InlineKeyboardMarkup()
    click_btn = types.InlineKeyboardButton('🖱️ Клик!', callback_data='click')
    shop_btn = types.InlineKeyboardButton('🛒 Магазин', callback_data='shop')
    stats_btn = types.InlineKeyboardButton('📊 Статистика', callback_data='stats')
    
    markup.add(click_btn)
    markup.row(shop_btn, stats_btn)
    
    welcome_text = f"""🎉 Добро пожаловать в Кликер Бот!
    
Нажимай на кнопку и зарабатывай очки!"""

    bot.send_message(message.chat.id, welcome_text, reply_markup=markup)

# Обработчик callback кнопок
@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    user_id = call.from_user.id
    user_data = get_user_data(user_id)
    
    if call.data == 'click':
        user_data['clicks'] += user_data['click_power']
        save_data()
        
        # Обновляем сообщение с новым счетом
        markup = types.InlineKeyboardMarkup()
        click_btn = types.InlineKeyboardButton('🖱️ Клик!', callback_data='click')
        shop_btn = types.InlineKeyboardButton('🛒 Магазин', callback_data='shop')
        stats_btn = types.InlineKeyboardButton('📊 Статистика', callback_data='stats')
        
        markup.add(click_btn)
        markup.row(shop_btn, stats_btn)
        
        bot.edit_message_text(
            chat_id=call.message.chat.id,
            message_id=call.message.message_id,
            text=f"""🖱️ Кликер Бот

Очки: {user_data['clicks']}
Уровень: {user_data['level']}
Сила клика: {user_data['click_power']}
Автокликеры: {user_data['auto_clickers']}

Нажимай на кнопку и зарабатывай очки!""",
            reply_markup=markup
        )
        bot.answer_callback_query(call.id, f"+{user_data['click_power']} очков!")
        
    elif call.data == 'shop':
        show_shop(call.message.chat.id, call.id)
        
    elif call.data == 'stats':
        show_stats(call.message.chat.id, call.id, user_data)
        
    elif call.data.startswith('buy_'):
        buy_item(call, user_data)

# Показ магазина
def show_shop(chat_id, callback_id):
    markup = types.InlineKeyboardMarkup()
    
    # Улучшения клика
    power_btn = types.InlineKeyboardButton(
        f"Улучшить клик (+1) - 50 очков", 
        callback_data='buy_power'
    )
    
    # Автокликеры
    auto_btn = types.InlineKeyboardButton(
        f"Купить автокликер - 200 очков", 
        callback_data='buy_auto'
    )
    
    back_btn = types.InlineKeyboardButton('⬅️ Назад', callback_data='click')
    
    markup.add(power_btn)
    markup.add(auto_btn)
    markup.add(back_btn)
    
    bot.edit_message_text(
        chat_id=chat_id,
        message_id=bot.get_updates()[-1].callback_query.message.message_id if bot.get_updates() else None,
        text="🛒 Магазин улучшений",
        reply_markup=markup
    )
    bot.answer_callback_query(callback_id)

# Показ статистики
def show_stats(chat_id, callback_id, user_data):
    stats_text = f"""📊 Твоя статистика:

Очки: {user_data['clicks']}
Уровень: {user_data['level']}
Сила клика: {user_data['click_power']}
Автокликеры: {user_data['auto_clickers']}

Общее количество кликов: {user_data['clicks']}"""

    markup = types.InlineKeyboardMarkup()
    back_btn = types.InlineKeyboardButton('⬅️ Назад', callback_data='click')
    markup.add(back_btn)
    
    bot.edit_message_text(
        chat_id=chat_id,
        message_id=bot.get_updates()[-1].callback_query.message.message_id if bot.get_updates() else None,
        text=stats_text,
        reply_markup=markup
    )
    bot.answer_callback_query(callback_id)

# Покупка предметов
def buy_item(call, user_data):
    item = call.data.split('_')[1]
    chat_id = call.message.chat.id
    callback_id = call.id
    
    if item == 'power':
        if user_data['clicks'] >= 50:
            user_data['clicks'] -= 50
            user_data['click_power'] += 1
            save_data()
            bot.answer_callback_query(callback_id, "✅ Улучшение куплено!")
        else:
            bot.answer_callback_query(callback_id, "❌ Недостаточно очков!")
            
    elif item == 'auto':
        if user_data['clicks'] >= 200:
            user_data['clicks'] -= 200
            user_data['auto_clickers'] += 1
            save_data()
            bot.answer_callback_query(callback_id, "✅ Автокликер куплен!")
        else:
            bot.answer_callback_query(callback_id, "❌ Недостаточно очков!")
    
    # Обновляем магазин
    show_shop(chat_id, callback_id)

# Автокликеры
def auto_clicker_worker():
    while True:
        time.sleep(5)  # Каждые 5 секунд
        for user_id, user_data in list(users_data.items()):
            if user_data['auto_clickers'] > 0:
                user_data['clicks'] += user_data['auto_clickers']
        save_data()

# Flask маршруты
@app.route('/')
def index():
    return jsonify({"message": "Telegram Clicker Bot is running!"})

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

if __name__ == '__main__':
    # Запуск потока для автокликеров
    auto_clicker_thread = threading.Thread(target=auto_clicker_worker, daemon=True)
    auto_clicker_thread.start()
    
    # Запуск Flask приложения
    app.run(host='0.0.0.0', port=PORT, debug=False)