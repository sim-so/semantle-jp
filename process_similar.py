import pickle
from typing import Tuple, List, Dict

import numpy as np
from numpy import array


def most_similar(mat: array, idx: int, k: int) -> Tuple[array, array]:
    vec = mat[idx]
    dists = mat.dot(vec) / (np.linalg.norm(mat, axis=1) * np.linalg.norm(vec))
    top_idxs = np.argpartition(dists, -k)[-k:]
    dist_sort_args = dists[top_idxs].argsort()[::-1]
    return top_idxs[dist_sort_args], dists[top_idxs][dist_sort_args]


def dump_nearest(puzzle_num: int, word: str, words: List[str], mat: array, k: int = 1000) \
        -> Dict[str, Tuple[str, float]]:
    words_a = np.array(words)
    word_idx = words.index(word)
    sim_idxs, sim_dists = most_similar(mat, word_idx, k + 1)
    sort_args = np.argsort(sim_dists)[::-1]
    words_sorted = words_a[sim_idxs[sort_args]]
    dists_sorted = sim_dists[sort_args]
    result = zip(words_sorted, dists_sorted)
    closeness = dict()
    for idx, (w, d) in enumerate(result):
        closeness[w] = (idx, d)
    closeness[word] = ("正解!", 1)
    words_vec_idx = sim_idxs[sort_args].tolist()
    with open(f'data/near/{puzzle_num}.dat', 'wb') as f:
        pickle.dump((closeness, words_vec_idx), f)
    return closeness, words_vec_idx


def get_nearest(puzzle_num: int, word: str, words: List[str], mat: array) -> Dict[str, Tuple[str, float]]:
    print(f"getting nearest words for {puzzle_num}")
    # for the update 0628
    try: 
        return dump_nearest(puzzle_num, word, words, mat)
    except Exception as e:
        print(e)
    try:
        with open(f'data/near/{puzzle_num}.dat', 'rb') as f:
            return pickle.load(f)
    except FileNotFoundError:
        return dump_nearest(puzzle_num, word, words, mat)
    
def get_farthest(word: str, words: List[str], words_vec_idx: array, mat: array, k: int = 300) -> str:
    words_a = np.array(words)
    words_vec_idx_a = np.array(words_vec_idx)
    word_idx = words.index(word)
    mat = mat[words_vec_idx_a]
    sim_idxs, sim_dists = most_similar(mat, word_idx, k)
    sort_args = np.argsort(sim_dists)
    words_sorted = words_a[sim_idxs[sort_args]]
    return words_sorted[0]