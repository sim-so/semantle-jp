/*
    Copyright (c) 2022, Johannes Gätjen, forked from Semantle by David Turner <novalis@novalis.org> semantle.novalis.org

     This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
'use strict';

let gameOver = false;
let guesses = [];
let guessed = new Set();
let guessCount = 0;
let model = null;
let numPuzzles = 2860;
const now = Date.now();
const initialDate = new Date('2023-04-02T00:00:00+09:00');
const puzzleNumber = Math.floor((new Date() - initialDate) / 86400000) % numPuzzles;
const yesterdayPuzzleNumber = (puzzleNumber + numPuzzles - 1) % numPuzzles;
const storage = window.localStorage;
let chrono_forward = 1;
let hints_used = 0;
var hints_words = JSON.parse(storage.getItem("hints_words") || "[]");
let prefersDarkColorScheme = false;
// settings
let darkMode = storage.getItem("darkMode") === 'true';
let shareGuesses = storage.getItem("shareGuesses") === 'false' ? false: true;
let shareTime = storage.getItem("shareTime") === 'false' ? false: true;
let shareTopGuess = storage.getItem("shareTopGuess") === 'false' ? false: true;
let shareTopInfo = storage.getItem("shareTopInfo") === 'false' ? false: true;

function $(id) {
    if (id.charAt(0) !== '#') return false;
    return document.getElementById(id.substring(1));
}

function share() {
    // We use the stored guesses here, because those are not updated again
    // once you win -- we don't want to include post-win guesses here.
    const text = solveStory(JSON.parse(storage.getItem("guesses")), 
                            puzzleNumber,
                            parseInt(storage.getItem("winState")),
                            hints_used);
    const copied = ClipboardJS.copy(text);

    if (copied) {
        alert("クリップボードに保存されました。");
    }
    else {
        alert("クリップボードに保存できません。");
    }
}

const words_selected = [];
const cache = {};
let similarityStory = null;

function guessRow(similarity, oldGuess, percentile, guessNumber, guess) {
    let percentileText = typeof percentile === 'number' ? "1000位以下" : percentile;
    let progress = "";
    let closeClass = "";
    if (similarity >= similarityStory.rest * 100 && percentile > 1000) {
        percentileText = '<span class="weirdWord">????<span class="tooltiptext">この単語は辞書にはありませんが、データベースに含まれ、1,000位以内にランクインしています。</span></span>';
    }
    var hw = '';
    if (hints_words.indexOf(oldGuess) !== -1) {
        hw = ' 💡';
    }
    if (percentile < 1001) {
            closeClass = "close";
            percentileText = `<span class="percentile">${percentile}</span>&nbsp;`;
            progress = ` <span class="progress-container">
<span class="progress-bar" style="width:${(1001 - percentile)/10}%">&nbsp;</span>
</span>`;
    }
    let color;
    if (oldGuess === guess) {
        color = '#c0c';
    } else if (darkMode) {
        color = '#fafafa';
    } else {
        color = '#000';
    }
    return `<tr><td>${guessNumber}</td><td style="color:${color}" onclick="select('${oldGuess}', secretVec);">${oldGuess}${hw}</td><td>${similarity.toFixed(2)}</td><td class="${closeClass}">${percentileText}${progress}
</td></tr>`;

}

function getUpdateTimeHours() {
    const midnightUtc = new Date();
    midnightUtc.setUTCHours(24, 0, 0, 0);
    return midnightUtc.getHours();
}

function solveStory(guesses, puzzleNumber, winState, hints_used) {
    let guess_count = guesses.length;
    let winOrGiveUp = 'ギブアップ';
    if (winState == 1) {
        winOrGiveUp = '正解!';
        if (guess_count == 1) {
            return `お見事です!初答えでパズル${puzzleNumber}の正解に当てました! https://semantoru.com/`;
        }
    }
    if (guess_count == 0) {
        return `パズル${puzzleNumber}を開けてすぐあきらめました。 https://semantoru.com/`;
    }

    let describe = function(similarity, percentile) {
        let out = `${similarity.toFixed(2)}`;
        if (percentile - 1001) {
            out += ` (ランク ${percentile})`;
        }
        return out;
    };

    let time = storage.getItem('endTime') - storage.getItem('startTime');
    let timeFormatted = new Date(time).toISOString().substr(11, 8).replace(":", "h").replace(":", "m");
    let timeInfo = `所要時間: ${timeFormatted}秒\n`;
    if (time > 24 * 3600000) {
        timeInfo = '所要時間: 24時間\n 以上';
    }
    if (!shareTime) {
        timeInfo = '';
    }

    let topGuessMsg = '';
    const topGuesses = guesses.slice();
    if (shareTopGuess) {
        topGuesses.sort(function(a, b){return b[0]-a[0]});
        const topGuess = topGuesses[0];
        let [similarity, old_guess, percentile, guess_number] = topGuess;
        topGuessMsg = `最高類似度: ${describe(similarity, percentile)}\n`;
    }
    let guessCountInfo = '';
    if (shareGuesses) {
        guessCountInfo = `推測した回数: ${guess_count}\n`;
    }

    let [numTop10, numTop100, numTop1000, numUnknown] = [0, 0, 0, 0]
    for (const element of topGuesses.slice(1)) {
        if (element[2] == '1000位以下') {
            if(element[0] >= similarityStory.rest * 100.0) {
                numUnknown += 1;
                continue;
            } else {
                break;
            }
        }
        if (element[2] <= 10) {
            numTop10 += 1;
        }
        if (element[2] <= 100) {
            numTop100 += 1;
        }
        if (element[2] <= 1000) {
            numTop1000 += 1;
        }
    }

    let topInfo = '';
    if (shareTopInfo) {
        topInfo = `上位10/100/1000/????: ${numTop10}/${numTop100}/${numTop1000}/${numUnknown}\n`;
    }

    return `今日のイミトル${puzzleNumber}(単語類似度推理ゲーム) ${winOrGiveUp}\n${guessCountInfo}` +
    `${timeInfo}${topGuessMsg}${topInfo}insertlink`;
}

let Semantle = (function() {
    async function getSimilarityStory(puzzleNumber) {
        const url = "/similarity/" + puzzleNumber;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function getGuess(word) {
        if (cache.hasOwnProperty(word)) {
            return cache[word];
        }
        const url = "/guess/" + puzzleNumber + "/" + word;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function submitGuess(guess, is_hint=false) {
        const guessData = await getGuess(guess);

        if (guessData == null) {
            $('#error').textContent = `サーバーが応答していません。再度お試しください。`
            return false;
        }
        if (guessData.error == "unknown") {
            $('#error').textContent = `「${guess}」はイミトルの辞書にはありません。`;
            return false;
        }

        cache[guess] = guessData;

        let percentile = guessData.rank;
        let similarity = guessData.sim * 100.0;
        if (!guessed.has(guess)) {
            if (guessCount == 0) {
                storage.setItem('startTime', Date.now())
            }
            guessCount += 1;
            guessed.add(guess);

            const newEntry = [similarity, guess, percentile, guessCount];
            guesses.push(newEntry);

            if (!gameOver) {
                const stats = getStats();
                if (!is_hint) {
                    stats['totalGuesses'] += 1;
                }
                storage.setItem('stats', JSON.stringify(stats));
            }
        }
        guesses.sort(function(a, b){return b[0]-a[0]});

        if (guessData.sim == 1 && !gameOver) {
            endGame(true, true);
        }

        if (!gameOver) {
            saveGame(-1, -1);
        }

        chrono_forward = 1;
        updateGuesses(guess);
    }


    async function getNearby(word) {
        const url = "/nearby/" + word ;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function suggestHint(guesses) {
    function highest_unguessed(guesses) {
        // The index of the first guess may be 0.
        for (let i = 0; i < guesses.length; i++) {
            if (guesses[i][2] !== i+1) {
                return i+1;
            }
        }
        // User can guess top n-words in a row, of course, rarely.
        // For instance, user has guesssed only top 3 words, then the 4th word will be suggested.
        if (guesses.length < 1000) {
            return guesses[guesses.length-1][2]+1
        }
        // user has guesses all of the top 1k except the actual word.
        return -1;
    }
    function getHintRank(guesses) {
        const top1k_guesses = guesses.filter(guess => guess[2] < 1001);
        if (top1k_guesses.length === 0) {
            return {
                hintType: "fixed",
                rank: 1000};
        }
        let highest = guesses[0][2];
        for (const guess of guesses) {
            highest = Math.min(guess[2], highest);
        }
        if (highest == 1) {
            return {
                hintType: "fixed",
                rank: highest_unguessed(top1k_guesses)};
        }
        return {
            hintType: "distance",
            rank: highest};
        }

    const hintParam = getHintRank(guesses);
    
    if (hintParam.rank < 0) {
        alert("残りのヒントがありません。");
    }
    const url = "/hint/" + puzzleNumber + "/" + hintParam.rank + "/" + hintParam.hintType;
    const response = await fetch(url);
    try {
        const hint_word = await response.text();
        hints_used += 1;
        hints_words.push(hint_word);
        storage.setItem("hint_words", JSON.stringify(hints_words));
        submitGuess(hint_word, true);
    } catch (e) {
        console.log(e);
        alert("Fetching hint failed");
    }
}

    async function getYesterday() {
        const url = "/yesterday/" + puzzleNumber
        try {
            return (await fetch(url)).text();
        } catch (e) {
            return null;
        }
    }

    async function init() {
        let yesterday = await getYesterday()
        $('#yesterday').innerHTML = `昨日の正解は<b>"${yesterday}"でした。</b>.`;
        $('#yesterday2').innerHTML = `昨日の正解は<b>"${yesterday}"でした。</b>.
        <a href="/nearest1k/${yesterdayPuzzleNumber}">ここ</a>で類似度ランク上位1,000位以内の単語を確認できます。`;
        // updateLocalTime();

        try {
            similarityStory = await getSimilarityStory(puzzleNumber);
            $('#similarity-story').innerHTML = `
            今日はパズル<b>${puzzleNumber}</b>です。今日の単語を当ててください。<br/>
            正解の単語と一番近い単語の類似度は<b>${(similarityStory.top * 100).toFixed(2)}</b>です。
            10番目に近い単語の類似度は${(similarityStory.top10 * 100).toFixed(2)}、
            1,000番目に近い単語の類似度は${(similarityStory.rest * 100).toFixed(2)}です。`;
        } catch {
            // we can live without this in the event that something is broken
        }

        const storagePuzzleNumber = storage.getItem("puzzleNumber");
        if (storagePuzzleNumber != puzzleNumber) {
            storage.removeItem("guesses");
            storage.removeItem("winState");
            storage.removeItem("startTime");
            storage.removeItem("endTime");
            storage.removeItem("hints_words");
            storage.removeItem("hints_used");
            storage.setItem("puzzleNumber", puzzleNumber);
        }

        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            prefersDarkColorScheme = true;
        }

        if (!storage.getItem("readRules")) {
            openRules();
        }

        $("#rules-button").addEventListener('click', openRules);
        $("#settings-button").addEventListener('click', openSettings);

        document.querySelectorAll(".dialog-underlay, .dialog-close").forEach((el) => {
            el.addEventListener('click', () => {
                document.body.classList.remove('dialog-open', 'rules-open', 'settings-open');
            });
        });

        document.querySelectorAll(".dialog").forEach((el) => {
            el.addEventListener("click", (event) => {
                // prevents click from propagating to the underlay, which closes the rules
                event.stopPropagation();
            });
        });

        $('#dark-mode').addEventListener('click', function(event) {
            storage.setItem('darkMode', event.target.checked);
            toggleDarkMode(event.target.checked);
        });

        toggleDarkMode(darkMode);

        $('#share-guesses').addEventListener('click', function(event) {
            storage.setItem('shareGuesses', event.target.checked);
            shareGuesses = event.target.checked;
        });

        $('#share-time').addEventListener('click', function(event) {
            storage.setItem('shareTime', event.target.checked);
            shareTime = event.target.checked;
        });

        $('#share-top-guess').addEventListener('click', function(event) {
            storage.setItem('shareTopGuess', event.target.checked);
            shareTopGuess = event.target.checked;
        });


        $('#dark-mode').checked = darkMode;
        $('#share-guesses').checked = shareGuesses;
        $('#share-time').checked = shareTime;
        $('#share-top-guess').checked = shareTopGuess;

        $('#give-up-btn').addEventListener('click', async function(event) {
            if (!gameOver) {
                if (confirm("ギブアップして、今日の正解を見ますか？")) {
                    const url = '/giveup/' + puzzleNumber;
                    const secret = await (await fetch(url)).text();
                    guessed.add(secret);
                    guessCount += 1;
                    const newEntry = [100, secret, '正解', guessCount];
                    cache[secret] = {"guess": secret, "rank": "ランク", "sim": 1};
                    guesses.push(newEntry);
                    guesses.sort(function(a, b){return b[0]-a[0]});
                    updateGuesses(guess);
                    endGame(false, true);
                }
            }
        });

        $('#hint-btn').addEventListener('click', async function(event) {
            if (!gameOver) {
                await suggestHint(guesses);    /* Amendment for Apr 25, 2023 */
            }
        });

        $('#form').addEventListener('submit', async function(event) {
            event.preventDefault();
            $('#guess').focus();
            $('#error').textContent = "";
            let guess = $('#guess').value.trim().replace("!", "").replace("*", "").replaceAll("/", "");
            if (!guess) {
                return false;
            }

            $('#guess').value = "";

            let gres = await submitGuess(guess);

            if (gres != false) {
                $('#guess').value = "";
            }

            return false;
        });

        const winState = storage.getItem("winState");
        if (winState != null) {
            hints_words = JSON.parse(storage.getItem("hints_words") || "[]");
            hints_used = JSON.parse(storage.getItem("hints_used") || "0");
            guesses = JSON.parse(storage.getItem("guesses"));
            for (let guess of guesses) {
                guessed.add(guess[1]);
            }
            guessCount = guessed.size;
            updateGuesses("");
            if (winState != -1) {
                endGame(winState > 0, false);
            }
        }
    }

    function openRules() {
        document.body.classList.add('dialog-open', 'rules-open');
        storage.setItem("readRules", true);
    }

    function openSettings() {
        document.body.classList.add('dialog-open', 'settings-open');
    }

    function updateGuesses(guess) {
        let inner = `<tr><th id="chronoOrder">#</th><th id="alphaOrder">推測した単語</th><th id="similarityOrder">類似度</th><th>類似度ランク</th></tr>`;
        /* This is dumb: first we find the most-recent word, and put
           it at the top.  Then we do the rest. */
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess == guess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber, guess);
            }
        }
        inner += "<tr><td colspan=4><hr></td></tr>";
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess != guess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber);
            }
        }
        $('#guesses').innerHTML = inner;
        $('#chronoOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return chrono_forward * (a[3]-b[3])});
            chrono_forward *= -1;
            updateGuesses(guess);
        });
        $('#alphaOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return a[1].localeCompare(b[1])});
            chrono_forward = 1;
            updateGuesses(guess);
        });
        $('#similarityOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return b[0]-a[0]});
            chrono_forward = 1;
            updateGuesses(guess);
        });
    }

    function toggleDarkMode(on) {
        document.body.classList[on ? 'add' : 'remove']('dark');
        const darkModeCheckbox = $("#dark-mode");
        darkMode = on;
        // this runs before the DOM is ready, so we need to check
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = on;
        }
    }

    function checkMedia() {
        let darkMode = storage.getItem("darkMode") === 'true';
        toggleDarkMode(darkMode);
    }

    function toggleUmlautButtons(on) {
        if (on) {
            $('#umlaut-buttons').style="";
        } else {
            $('#umlaut-buttons').style="display:none";
        }
    }

    function saveGame(guessCount, winState) {
        // If we are in a tab still open from yesterday, we're done here.
        // Don't save anything because we may overwrite today's game!
        let savedPuzzleNumber = storage.getItem("puzzleNumber");
        if (savedPuzzleNumber != puzzleNumber) { return }

        storage.setItem("winState", winState);
        storage.setItem("guesses", JSON.stringify(guesses));
        storage.setItem("hints_used", JSON.stringify(hints_used));
        storage.setItem("hints_words", JSON.stringify(hints_words));
    }

    function getStats() {
        const oldStats = storage.getItem("stats");
        if (oldStats == null) {
            const stats = {
                'firstPlay' : puzzleNumber,
                'lastEnd' : puzzleNumber - 1,
                'lastPlay' : puzzleNumber,
                'winStreak' : 0,
                'playStreak' : 0,
                'totalGuesses' : 0,
                'wins' : 0,
                'giveups' : 0,
                'abandons' : 0,
                'totalPlays' : 0,
                'hints' : 0,
            };
            storage.setItem("stats", JSON.stringify(stats));
            return stats;
        } else {
            const stats = JSON.parse(oldStats);
            stats['hints'] = stats['hints'] || 0;
            if (stats['lastPlay'] != puzzleNumber) {
                const onStreak = (stats['lastPlay'] == puzzleNumber - 1);
                if (onStreak) {
                    stats['playStreak'] += 1;
                }
                stats['totalPlays'] += 1;
                if (stats['lastEnd'] != puzzleNumber - 1) {
                    stats['abandons'] += 1;
                }
                stats['lastPlay'] = puzzleNumber;
            }
            return stats;
        }
    }

    function endGame(won, countStats) {
        let stats = getStats();
        if (storage.getItem('endTime') == null) {
            storage.setItem('endTime', Date.now())
        }
        if (countStats) {
            const onStreak = (stats['lastEnd'] == puzzleNumber - 1);

            stats['lastEnd'] = puzzleNumber;
            if (won) {
                if (onStreak) {
                    stats['winStreak'] += 1;
                } else {
                stats['winStreak'] = 1;
                }
                stats['wins'] += 1;
            } else {
                stats['winStreak'] = 0;
                stats['giveups'] += 1;
            }
            stats['hints'] += hints_used;
            storage.setItem("stats", JSON.stringify(stats));
        }

        $('#give-up-btn').style = "display:none;";
        $('#response').classList.add("gaveup");
        gameOver = true;
        let response;
        if (won) {
            response = `<p><b>正解です! ${guesses.length}回の答えで当たりました!</b> `;
        } else {
            response = `<p><b>${guesses.length - 1}回でやめました。</b> `;
        }
        const commonResponse = `正解の単語と最も近い上位1,000位の単語は<a href="/nearest1k/${puzzleNumber}">ここ</a>で確認できます。</p> <p>新しいパズルは今夜12時に開きます。</p>`
        response += commonResponse;
        response += `<input type="button" value="記録を保存する" id="result" onclick="share()" class="button"><br />`
        const totalGames = stats['wins'] + stats['giveups'] + stats['abandons'];
        response += `<br/>
記録: <br/>
<table>
<tr><th>初めて解けたパズル:</th><td>${stats['firstPlay']}</td></tr>
<tr><th>プレイ回数:</th><td>${totalGames}</td></tr>
<tr><th>正解回数:</th><td>${stats['wins']}</td></tr>
<tr><th>連続正解回数:</th><td>${stats['winStreak']}</td></tr>
<tr><th>ギブアップしたゲームの数:</th><td>${stats['giveups']}</td></tr>
<tr><th>これまで推測した単語の数:</th><td>${stats['totalGuesses']}</td></tr>
<tr><th>ヒントの単語の数:</th><td>${stats['hints']}</td></tr>
</table>
`;
        $('#response').innerHTML = response;

        hints_used = [];
        if (countStats) {
            saveGame(guesses.length, won ? 1 : 0);
        }
    }

    return {
        init: init,
        checkMedia: checkMedia,
    };
})();

// do this when the file loads instead of waiting for DOM to be ready to avoid
// a flash of unstyled content
Semantle.checkMedia();
    
window.addEventListener('load', async () => { Semantle.init() });
