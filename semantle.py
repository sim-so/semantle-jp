import pickle
from datetime import date, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from flask import (
    Flask,
    send_file,
    send_from_directory,
    jsonify,
    render_template
)
from pytz import utc, timezone

import word2vec
from process_similar import get_nearest, get_farthest

JST = timezone('Asia/Tokyo')

NUM_SECRETS = 2860
FIRST_DAY = date(2023, 4, 2)
scheduler = BackgroundScheduler()
scheduler.start()

app = Flask(__name__)
print("loading valid nearest")
with open('data/valid_nearest.dat', 'rb') as f:
    valid_nearest_words, valid_nearest_vecs = pickle.load(f)
with open('data/secrets.txt', 'r', encoding='utf-8') as f:
    secrets = [l.strip() for l in f.readlines()]
print("initializing nearest words for solutions")
app.secrets = dict()
app.nearests = dict()
app.nearests_words = dict()
app.nearests_words_vec_idx = dict()
current_puzzle = (utc.localize(datetime.utcnow()).astimezone(JST).date() - FIRST_DAY).days % NUM_SECRETS
for offset in range(-2, 2):
    puzzle_number = (current_puzzle + offset) % NUM_SECRETS
    secret_word = secrets[puzzle_number]
    app.secrets[puzzle_number] = secret_word
    app.nearests[puzzle_number], app.nearests_words_vec_idx[puzzle_number] = get_nearest(puzzle_number, secret_word, valid_nearest_words, valid_nearest_vecs)
    app.nearests_words[puzzle_number] = [word for word in app.nearests[puzzle_number].keys()]


@scheduler.scheduled_job(trigger=CronTrigger(hour=1, minute=0, timezone=JST))
def update_nearest():
    print("scheduled stuff triggered!")
    next_puzzle = ((utc.localize(datetime.utcnow()).astimezone(JST).date() - FIRST_DAY).days + 1) % NUM_SECRETS
    next_word = secrets[next_puzzle]
    to_delete = (next_puzzle - 4) % NUM_SECRETS
    if to_delete in app.secrets:
        del app.secrets[to_delete]
    if to_delete in app.nearests:
        del app.nearests[to_delete]
    if to_delete in app.nearests_words:
        del app.nearests_words[to_delete]
    app.secrets[next_puzzle] = next_word
    app.nearests[next_puzzle] = get_nearest(next_puzzle, next_word, valid_nearest_words, valid_nearest_vecs)
    app.nearests_words[next_puzzle] = [word for word in app.nearests[next_puzzle].keys()]


@app.route('/')
def get_index():
    return render_template('index.html')


@app.route("/favicon.ico")
def send_favicon():
    return send_file("static/assets/favicon.ico")


@app.route("/assets/<path:path>")
def send_static(path):
    return send_from_directory("static/assets", path)


@app.route('/guess/<int:day>/<string:word>')
def get_guess(day: int, word: str):
    if app.secrets[day].lower() == word.lower():
        word = app.secrets[day]
    rtn = {"guess": word}
    # check most similar
    if day in app.nearests and word in app.nearests[day]:
        rtn["sim"] = app.nearests[day][word][1]
        rtn["rank"] = app.nearests[day][word][0]
    else:
        try:
            rtn["sim"] = word2vec.similarity(app.secrets[day], word)
            rtn["rank"] = 1001
        except KeyError:
            return jsonify({"error": "unknown"}), 404
    return jsonify(rtn)


@app.route('/similarity/<int:day>')
def get_similarity(day: int):
    top, top10, rest = app.nearests_words[day][1], app.nearests_words[day][10], app.nearests_words[day][-1]
    return jsonify({"top": app.nearests[day][top][1], "top10": app.nearests[day][top10][1], "rest": app.nearests[day][rest][1]})


@app.route('/yesterday/<int:today>')
def get_solution_yesterday(today: int):
    return app.secrets[(today - 1) % NUM_SECRETS]


@app.route('/nearest1k/<int:day>')
def get_nearest_1k(day: int):
    if day not in app.secrets:
        return "この日の最も近い単語は今使用できません。" \
               "一昨日から明日までのだけ確認できます。", 404
    solution = app.secrets[day]
    words = [
        dict(
            word=w,
            rank=k[0],
            similarity="%0.2f" % (k[1] * 100))
        for w, k in app.nearests[day].items() if w != solution]
    return render_template('top1k.html', word=solution, words=words, day=day)


@app.route('/giveup/<int:day>')
def give_up(day: int):
    if day not in app.secrets:
        return '残念ですね。。。', 404
    else:
        return app.secrets[day]
    
@app.route('/hint/<int:day>/<int:rank>/<string:hint_type>')
def get_hint(day: int, rank: int, hint_type: str):
    if hint_type == "const":
        return app.nearests_words[day][rank]
    elif hint_type == "distance":
        highest_word = app.nearests_words[day][rank]
        k = int(rank / 3)
        k_words = app.nearests_words[day][rank-k:rank+1]
        k_words_idx = app.nearests_words_vec_idx[day][rank-k:rank+1]
        return get_farthest(highest_word, k_words, k_words_idx, valid_nearest_vecs, k)