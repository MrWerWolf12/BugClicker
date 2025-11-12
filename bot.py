import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
import os

# Включаем логирование
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# Получаем токен из переменных окружения
TOKEN = os.environ.get('TELEGRAM_TOKEN')
APP_URL = os.environ.get('APP_URL')  # URL вашего приложения на render.com

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Отправляет приветственное сообщение с кнопкой для запуска игры"""
    user_id = update.effective_user.id
    keyboard = [
        [InlineKeyboardButton("🎮 Играть в кликер", url=f"{APP_URL}?user={user_id}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🌟 Добро пожаловать в Кликер божьей коровки!\n\n"
        "Нажмите кнопку ниже, чтобы начать играть. "
        "Кликайте на божью коровку, чтобы зарабатывать очки и повышать уровень!",
        reply_markup=reply_markup
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Отправляет справку"""
    await update.message.reply_text(
        "🎮 Как играть:\n"
        "1. Нажмите кнопку 'Играть в кликер'\n"
        "2. Кликайте на божью коровку\n"
        "3. Зарабатывайте очки и повышайте уровень!\n\n"
        "Каждые 10 кликов = +1 уровень"
    )

def main() -> None:
    """Запуск бота"""
    # Создаем приложение с токеном
    application = Application.builder().token(TOKEN).build()

    # Добавляем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))

    # Запуск бота в режиме polling
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()