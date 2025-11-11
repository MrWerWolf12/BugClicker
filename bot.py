import asyncio
import os
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not set")
if not WEBAPP_URL:
    raise RuntimeError("WEBAPP_URL is not set")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def on_start(msg: Message):
    kb = ReplyKeyboardMarkup(
        resize_keyboard=True,
        keyboard=[
            [KeyboardButton(text="Открыть кликер", web_app=WebAppInfo(url=WEBAPP_URL))]
        ]
    )
    await msg.answer("Нажми кнопку, чтобы открыть мини‑приложение.", reply_markup=kb)

async def main():
    print("Bot started (long polling)")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())

if __name__ == "__main__":
    asyncio.run(main())