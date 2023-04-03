import pickle
from itertools import count
from random import Random
import unicodedata
from process_vecs import is_japanese

rnd = Random(11235813)
limit = 3000

early_solutions = ["目標", "助言"]

if __name__ == '__main__':
    with open('data/valid_nearest.dat', 'rb') as f:
        valid_nearest_words, _ = pickle.load(f)
    with open('data/frequent_words.txt', 'r', encoding='UTF-8') as f:
        file_content = f.readlines()
    words = set()
    removed = set()
    for line in file_content:
        word = unicodedata.normalize("NFKC", line.strip())
        if is_japanese(word) and word in valid_nearest_words:
            words.add(word)
        else:
            removed.add(word)
        if len(words) >= limit:
            break
    words = words.difference(early_solutions)
    print('removed:', len(removed), removed)
    shuffle_list = list(words)
    shuffle_list.sort()
    rnd.shuffle(shuffle_list)
    valid_nearest_words = set(valid_nearest_words)
    shuffle_list = early_solutions + shuffle_list
    print('# words:', len(shuffle_list))
    with open('data/secrets.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(shuffle_list))
