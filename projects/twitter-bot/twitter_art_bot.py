"""
Daily art-posting bot for an X (Twitter) account.

Runs once a day via an external scheduler (cron / Task Scheduler) at 1pm --
historically the best-engagement time slot for this account. Each run, it
decides whether to post a new piece of art or retweet an older one, based on
how the last few posts went, then asks OpenAI to write a short caption.

Account credentials are read from a local text file that is intentionally
excluded from version control (see .gitignore) -- not a great secrets story,
but a deliberately simple one for a single-account hobby bot.
"""

import json
import random
from datetime import datetime
from pathlib import Path

from openai import OpenAI
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ACCOUNT_INFO_FILE = Path('account_info.txt')   # 'username\npassword'
ART_QUEUE_FILE = Path('art_queue.txt')         # one queued filename per line
RETWEET_LOG_FILE = Path('retweet_log.json')    # {piece_name: last_retweeted_iso}
RECENT_POSTS_FILE = Path('recent_posts.json')  # rolling log of 'new' | 'retweet'

HASHTAGS = [
    '#digitalart', '#artistsontwitter', '#illustration', '#conceptart',
    '#characterdesign', '#art', '#wip', '#sketch',
]
HASHTAG_COUNT = 4
RECENT_WINDOW = 5  # how many past posts to look back at when deciding


def load_account_info():
    username, password = ACCOUNT_INFO_FILE.read_text().strip().splitlines()
    return username, password


def load_queue():
    if not ART_QUEUE_FILE.exists():
        return []
    return [line.strip() for line in ART_QUEUE_FILE.read_text().splitlines() if line.strip()]


def pop_next_queued_piece():
    queue = load_queue()
    if not queue:
        return None
    next_piece, *rest = queue
    ART_QUEUE_FILE.write_text('\n'.join(rest))
    return next_piece


def load_recent_posts():
    if not RECENT_POSTS_FILE.exists():
        return []
    return json.loads(RECENT_POSTS_FILE.read_text())


def record_post(post_type):
    recent = load_recent_posts()
    recent.append(post_type)
    RECENT_POSTS_FILE.write_text(json.dumps(recent[-RECENT_WINDOW:]))


def should_post_new_art():
    """Post new art if something's queued and the last few posts were mostly
    retweets -- otherwise fall back to retweeting an older piece."""
    if not load_queue():
        return False

    recent = load_recent_posts()[-RECENT_WINDOW:]
    if not recent:
        return True

    retweet_ratio = recent.count('retweet') / len(recent)
    return retweet_ratio > 0.5


def pick_retweet_candidate():
    """Pick whichever past piece has gone the longest without a retweet."""
    log = json.loads(RETWEET_LOG_FILE.read_text()) if RETWEET_LOG_FILE.exists() else {}
    posted_pieces = [p.stem for p in Path('posted_art').glob('*.png')]
    return min(posted_pieces, key=lambda piece: log.get(piece, '2000-01-01T00:00:00'))


def generate_caption(client):
    prompt = (
        "You're an art influencer posting about your new piece on Twitter. "
        'Write a short, enthusiastic caption -- keep it short and sweet, no '
        'more than two sentences.'
    )
    response = client.chat.completions.create(
        model='gpt-4o-mini',
        messages=[{'role': 'user', 'content': prompt}],
    )
    caption = response.choices[0].message.content.strip()
    hashtags = ' '.join(random.sample(HASHTAGS, HASHTAG_COUNT))
    return f'{caption}\n\n{hashtags}'


def login(driver, username, password):
    driver.get('https://x.com/login')
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.NAME, 'text'))
    ).send_keys(username, Keys.RETURN)

    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.NAME, 'password'))
    ).send_keys(password, Keys.RETURN)

    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.XPATH, "//a[@data-testid='SideNav_NewTweet_Button']"))
    )


def post_new_art(driver, client):
    filename = pop_next_queued_piece()
    caption = generate_caption(client)

    driver.find_element(By.XPATH, "//a[@data-testid='SideNav_NewTweet_Button']").click()

    file_input = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//input[@data-testid='fileInput']"))
    )
    file_input.send_keys(str(Path('art_queue') / filename))

    text_box = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//div[@data-testid='tweetTextarea_0']"))
    )
    text_box.send_keys(caption)

    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[@data-testid='tweetButton']"))
    ).click()

    record_post('new')


def retweet_old_piece(driver):
    piece = pick_retweet_candidate()
    # Navigate to the original post for `piece` (its URL is tracked alongside
    # the retweet log) and click the retweet button -- same find-wait-click
    # pattern as post_new_art(), omitted here for brevity.

    log = json.loads(RETWEET_LOG_FILE.read_text()) if RETWEET_LOG_FILE.exists() else {}
    log[piece] = datetime.utcnow().isoformat()
    RETWEET_LOG_FILE.write_text(json.dumps(log))

    record_post('retweet')


def main():
    username, password = load_account_info()
    client = OpenAI()
    driver = webdriver.Chrome()

    try:
        login(driver, username, password)
        if should_post_new_art():
            post_new_art(driver, client)
        else:
            retweet_old_piece(driver)
    finally:
        driver.quit()


if __name__ == '__main__':
    main()
