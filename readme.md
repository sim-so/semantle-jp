# イミトル(Semantle日本語版) - 単語類似度パズル
> このリポジトリはJohannes Gätjenさんの[Semantlich](http://semantlich.johannesgaetjen.de/)をフォークしたものです。

## 設置 Settings

### Create virtualenv
```bash
python3.10 -m venv semantle-jp
source semantle-jp/bin/activate
```

### Install requirements
```bash
pip install -r requirements.txt
```

### Download Word2Vec
```bash
cd data
wget https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.ja.300.vec.gz
gzip -d cc.ja.300.vec.gz
```

### Save word2vec in dba
```bash
cd ..
python process_vecs.py
```

### (optional) Regenerate secrets
```bash
python generate_secrets.py
```

### Start flask/gunicorn (on ssh)
```bash
export FLASK_APP=semantle
nohup gunicorn semantle:app &
```

### Restart after pull
```bash
ps aux | grep gunicorn
kill -HUP <gunicorn pid>
```
