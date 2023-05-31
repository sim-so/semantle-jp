import pickle
from itertools import count
from random import Random
import unicodedata
from process_vecs import is_japanese

rnd = Random(11235813)
limit = 3000

with open('data/early_solutions.txt', 'r') as f:
    early_solutions = f.readlines()
early_solutions = [line.strip() for line in early_solutions]

if __name__ == '__main__':
    with open('data/candidates.txt', 'r', encoding='UTF-8') as f:
        candidates = f.readlines()
    candidates = [line.strip() for line in candidates]
    # with open('data/valid_nearest.dat', 'rb') as f:
    #     valid_nearest_words, _ = pickle.load(f)
    with open('data/frequent_words.txt', 'r', encoding='UTF-8') as f:
        file_content = f.readlines()
    words = set()
    removed = set()
    for line in file_content:
        word = unicodedata.normalize("NFKC", line.strip())
        if is_japanese(word) and word in candidates:
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
    candidates = set(candidates)
    shuffle_list = early_solutions + shuffle_list
    print('# words:', len(shuffle_list))
    with open('data/secrets.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(shuffle_list))
