from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///clicker.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    telegram_id = db.Column(db.String(50), unique=True, nullable=False)
    clicks = db.Column(db.Integer, default=0)
    level = db.Column(db.Integer, default=1)

@app.before_first_request
def create_tables():
    db.create_all()

@app.route('/')
def index():
    telegram_id = request.args.get('user')
    if not telegram_id:
        return "Ошибка: не указан пользователь", 400
    
    user = User.query.filter_by(telegram_id=telegram_id).first()
    if not user:
        user = User(telegram_id=telegram_id, clicks=0, level=1)
        db.session.add(user)
        db.session.commit()
    
    return render_template('index.html', user_id=telegram_id)

@app.route('/click', methods=['POST'])
def click():
    telegram_id = request.json.get('user')
    user = User.query.filter_by(telegram_id=telegram_id).first()
    
    if user:
        user.clicks += 1
        if user.clicks >= user.level * 10:  # Повышение уровня каждые 10 кликов
            user.level += 1
        db.session.commit()
        return jsonify({'clicks': user.clicks, 'level': user.level})
    return jsonify({'error': 'User not found'}), 404

@app.route('/stats')
def stats():
    telegram_id = request.args.get('user')
    user = User.query.filter_by(telegram_id=telegram_id).first()
    
    if user:
        return jsonify({'clicks': user.clicks, 'level': user.level})
    return jsonify({'clicks': 0, 'level': 1})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))