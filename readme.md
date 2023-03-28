### Setup
create virtualenv:
```bash
python3.10 -m venv semantle-jp
source semantle-de/bin/activate
```

install requirements
```bash
pip install -r requirements.txt
```

Download Word2Vec and dictionary data:
```bash
cd data
wget https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.ja.300.vec.gz
gzip -d cc.ja.300.vec.gz
wget https://clrd.ninjal.ac.jp/unidic_archive/cwj/3.1.0/unidic-cwj-3.1.0.zip
unzip -p unidic-cwj-3.1.0.zip unidic-cwj-3.1.0/lex_3_1.csv > lex.csv
```

save word2vec in db
```bash
cd ..
python process_vecs.py
```

(optional) Regenerate secrets
```bash
python generate_secrets.py
```

start flask/gunicorn (on ssh)
```bash
export FLASK_APP=semantle
nohup gunicorn semantle:app &
```

restart after pull
```bash
ps aux | grep gunicorn
kill -HUP <guniconr pid>
```

nginx...