import pickle
import sqlite3
import sys
from typing import Set
import unicodedata
import re

import numpy as np
from numpy import array


def is_japanese(text) -> bool:
    return bool(re.match(r'^[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u4e00-\u9faf]+$', text))

def load_dic(path: str) -> Set[str]:
    rtn = set()
    with open(path, 'r', encoding="utf-8") as f:
        for line in f.readlines():
            word = line.strip()
            word = unicodedata.normalize('NFKC', word)
            if is_japanese(word):
                rtn.add(word)
    return rtn

if __name__ == '__main__':
    skip_db = len(sys.argv) > 1 and sys.argv[1] == '-s'
    if skip_db:
        print('skipping db writing')
    connection = sqlite3.connect('data/valid_guesses.db')
    cursor = connection.cursor()
    cursor.execute("""CREATE TABLE IF NOT EXISTS guesses (word text PRIMARY KEY, vec blob)""")
    print("created table")
    normal_words = load_dic('data/standard_orth.txt')
    print("# words in dictionary:", len(normal_words))
    valid_nearest = []
    valid_nearest_mat = []
    eliminated = 0
    checked_words = set()
    with open('data/cc.ja.300.vec', 'r', encoding='utf-8') as w2v_file:
        _ = w2v_file.readline()
        for n, line in enumerate(w2v_file):
            # careful! some data sets (e.g. dewiki100.txt) have non-breaking spaces, which get split
            # others have trailing spaces (e.g. COW.token.wang2vec), meaning an empty string is included with split(' ')
            words = line.rstrip().split(' ')
            word = words[0]
            word = unicodedata.normalize('NFKC', word)
            if not is_japanese(word) or word in checked_words:
                eliminated += 1
            else:
                vec = array([float(w1) for w1 in words[1:]])
                if word in normal_words: 
                    valid_nearest.append(word)
                    valid_nearest_mat.append(vec)
                cursor.execute("""INSERT INTO guesses values (?, ?)""", (word, pickle.dumps(vec)))
            checked_words.add(word)
            if n % 100000 == 0:
                print(f"processed {n} (+1) lines")
                connection.commit()
    connection.commit()
    connection.close()
    print("not added to db:", eliminated)
    valid_nearest_mat = np.array(valid_nearest_mat)
    print("valid nearest shape:", valid_nearest_mat.shape)
    with open('data/valid_nearest.dat', 'wb') as f:
        pickle.dump((valid_nearest, valid_nearest_mat), f)
    print("done pickling matrix")