import os
import json
import hmac
import hashlib
from urllib.parse import parse_qsl
from collections import defaultdict
from typing import Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

from pydantic import BaseModel

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL", "").rstrip("/")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")

if not BOT_TOKEN:
    # Без BOT_TOKEN нельзя валидировать initData — останавливаем сервер
    raise RuntimeError("BOT_TOKEN is not set")

# Инициализируем бота и диспетчер (webhook-режим)
bot = Bot(BOT_TOKEN)
dp = Dispatcher()

app = FastAPI()

# Хранилище для демо (в памяти): user_id -> count
user_clicks: Dict[int, int] = defaultdict(int)

# -------------------- Telegram bot handlers --------------------

@dp.message(CommandStart())
async def on_start(msg: types.Message):
    if not WEBAPP_URL:
        await msg.answer("Веб-приложение еще не настроено. Сообщите администратору.")
        return

    kb = ReplyKeyboardMarkup(
        resize_keyboard=True,
        keyboard=[
            [KeyboardButton(text="Открыть кликер", web_app=WebAppInfo(url=WEBAPP_URL))]
        ]
    )
    await msg.answer("Нажми кнопку, чтобы открыть мини‑приложение.", reply_markup=kb)

# -------------------- Webhook setup --------------------

@app.on_event("startup")
async def on_startup():
    # Регистрируем webhook, если заданы WEBAPP_URL и WEBHOOK_SECRET
    if WEBAPP_URL and WEBHOOK_SECRET:
        url = f"{WEBAPP_URL}/webhook/{WEBHOOK_SECRET}"
        try:
            await bot.delete_webhook(drop_pending_updates=True)
            await bot.set_webhook(url, secret_token=WEBHOOK_SECRET)
            print(f"[Webhook] Set to {url}")
        except Exception as e:
            print(f"[Webhook] Failed to set: {e}")
    else:
        print("[Webhook] Skipped (WEBAPP_URL or WEBHOOK_SECRET is missing). Bot won't receive updates.")

@app.on_event("shutdown")
async def on_shutdown():
    await bot.session.close()

# Прием апдейтов от Telegram
@app.post("/webhook/{token}")
async def telegram_webhook(token: str, request: Request):
    # Проверяем секрет в пути и заголовке, чтобы блокировать чужие вызовы
    if WEBHOOK_SECRET and token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook token")
    header_secret = request.headers.get("x-telegram-bot-api-secret-token")
    if WEBHOOK_SECRET and header_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret header")

    data = await request.json()
    update = types.Update.model_validate(data)
    await dp.feed_update(bot, update)
    return JSONResponse({"ok": True})

# -------------------- Mini App frontend + API --------------------

def verify_init_data(init_data: str) -> Dict[str, Any]:
    """
    Валидация initData по документации Telegram WebApps:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    if not init_data:
        raise HTTPException(status_code=401, detail="Missing init data")

    parsed = dict(parse_qsl(init_data, strict_parsing=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="Missing hash")

    data_check_string = "\n".join(f"{k}={parsed[k]}" for k in sorted(parsed.keys()))
    secret_key = hmac.new(
        key=b"WebAppData",
        msg=BOT_TOKEN.encode(),
        digestmod=hashlib.sha256
    ).digest()
    calculated_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256
    ).hexdigest()

    if calculated_hash != received_hash:
        raise HTTPException(status_code=401, detail="Invalid init data signature")

    result = {}
    for k, v in parsed.items():
        if k in ("user", "receiver", "chat"):
            try:
                result[k] = json.loads(v)
            except Exception:
                result[k] = v
        else:
            result[k] = v
    return result

def extract_user_id_from_init_data(init_data: str) -> int:
    data = verify_init_data(init_data)
    user = data.get("user")
    if not user or "id" not in user:
        raise HTTPException(status_code=401, detail="No user in init data")
    return int(user["id"])

INDEX_HTML = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Кликер</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; 
           margin: 0; padding: 20px; background: var(--tg-theme-bg-color, #0f0f10); color: var(--tg-theme-text-color, #fff); }
    .card { max-width: 520px; margin: 0 auto; background: rgba(255,255,255,0.06); border-radius: 16px; padding: 20px; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    #count { font-size: 38px; margin: 12px 0 16px; font-weight: 700; }
    button { width: 100%; font-size: 22px; padding: 16px; border: none; border-radius: 12px; cursor: pointer;
             background: var(--tg-theme-button-color, #2ea6ff); color: var(--tg-theme-button-text-color, #fff); }
    button:active { transform: scale(0.98); }
    .top { margin-top: 20px; font-size: 14px; }
    .top h3 { margin: 0 0 8px; font-size: 16px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .muted { opacity: 0.75; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Кликер</h1>
    <div id="hello" class="muted"></div>
    <div id="count">0</div>
    <button id="tap">Тап!</button>

    <div class="top">
      <h3>Топ-10</h3>
      <div id="top"></div>
    </div>
  </div>

  <script>
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const initData = tg.initData || "";

    const helloEl = document.getElementById("hello");
    const countEl = document.getElementById("count");
    const topEl = document.getElementById("top");
    const btn = document.getElementById("tap");

    if (tg.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
      helloEl.textContent = "Привет, " + (name || "друг") + "!";
    }

    async function api(path, opts={}) {
      const res = await fetch(path, {
        ...opts,
        headers: {
          "X-Init-Data": initData,
          "Content-Type": "application/json",
          ...(opts.headers || {})
        }
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error("API error: " + res.status + " " + t);
      }
      return res.json();
    }

    async function refresh() {
      try {
        const data = await api("/api/state");
        countEl.textContent = data.count;
        topEl.innerHTML = "";
        for (const row of data.top) {
          const div = document.createElement("div");
          div.className = "row";
          const name = row.name || ("user " + row.user_id);
          div.innerHTML = "<span>" + name + "</span><span>" + row.count + "</span>";
          topEl.appendChild(div);
        }
      } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка загрузки: " + e.message);
      }
    }

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const data = await api("/api/click", { method: "POST", body: "{}" });
        countEl.textContent = data.count;
        if (Math.random() < 0.3) await refresh();
      } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка: " + e.message);
      } finally {
        btn.disabled = false;
      }
    });

    refresh();
  </script>
</body>
</html>
"""

class ClickPayload(BaseModel):
    pass

@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse(INDEX_HTML)

@app.get("/api/state")
async def get_state(request: Request):
    init_data = request.headers.get("X-Init-Data", "")
    user_id = extract_user_id_from_init_data(init_data)

    data = verify_init_data(init_data)
    name = None
    u = data.get("user")
    if isinstance(u, dict):
        name = " ".join([u.get("first_name") or "", u.get("last_name") or ""]).strip() or u.get("username")

    sorted_top = sorted(user_clicks.items(), key=lambda x: x[1], reverse=True)[:10]
    top = []
    for uid, cnt in sorted_top:
        top.append({
            "user_id": uid,
            "count": cnt,
            "name": name if uid == user_id else None
        })

    return JSONResponse({
        "user_id": user_id,
        "count": user_clicks[user_id],
        "top": top
    })

@app.post("/api/click")
async def do_click(request: Request, _: ClickPayload):
    init_data = request.headers.get("X-Init-Data", "")
    user_id = extract_user_id_from_init_data(init_data)
    user_clicks[user_id] += 1
    return JSONResponse({"ok": True, "count": user_clicks[user_id]})

# Простой healthcheck, если понадобится
@app.get("/healthz")
async def healthz():
    return PlainTextResponse("ok")