/* Host panel: owns ALL game state and decisions. The audience window is a dumb
 * renderer fed by postMessage snapshots. Sounds are on rails: every stage
 * transition fires its cue automatically — the host never picks a sound. */
(function () {
  'use strict';

  /* ============================== state ============================== */

  var game = null;          // parsed game file (rounds + fast_money)
  var audienceWin = null;   // window handle
  var audienceArmed = false;
  var timerInterval = null;

  var state = freshState();

  function freshState() {
    return {
      stage: 'setup',   // setup|ready|faceoff|playorpass|round|steal|roundover|fm-play|fm-reveal|gameover
      gameTitle: '',
      teams: [
        { name: 'TEAM 1', score: 0 },
        { name: 'TEAM 2', score: 0 }
      ],
      roundIndex: -1,
      round: null,        // {question, answers, revealed[], bank, bankAwarded, multiplier, strikes, controlTeam}
      faceoffWinner: null,
      showQuestion: true,
      fastMoney: null,    // {target, playingTeam, currentPlayer, questions, players[2].answers[5]}
      timer: null,        // {remaining, running, visible}
      winner: null
    };
  }

  /* ========================= sync / audio bus ========================= */

  var bc = null;
  try { bc = new BroadcastChannel('family-feud'); } catch (e) {}

  function audienceLive() {
    return audienceWin && !audienceWin.closed;
  }

  function send(msg) {
    try { if (audienceLive()) audienceWin.postMessage(msg, '*'); } catch (e) {}
    try { if (bc) bc.postMessage(msg); } catch (e) {}
  }

  /* Commit a state change: persist, sync to audience, redraw host UI.
   * fx = {cue, stopCue, stopAll, strikes, banner} — sound & transient visuals. */
  function commit(fx) {
    send({ kind: 'state', state: state });
    if (fx) {
      send({ kind: 'fx', fx: fx });
      // If no audience is connected (or it hasn't been clicked yet), sound
      // falls back to this window so the host can still run the show.
      if (!audienceLive() || !audienceArmed) {
        if (fx.stopAll) FeudSounds.stopAll();
        if (fx.stopCue) FeudSounds.stop(fx.stopCue);
        if (fx.cue) FeudSounds.play(fx.cue);
      }
    }
    try { localStorage.setItem('feud-state', JSON.stringify(state)); } catch (e) {}
    render();
  }

  window.addEventListener('message', function (ev) {
    var msg = ev.data;
    if (!msg || !msg.kind) return;
    if (msg.kind === 'hello') { send({ kind: 'state', state: state }); }
    if (msg.kind === 'armed') { audienceArmed = true; render(); }
  });
  if (bc) bc.onmessage = function (ev) {
    var msg = ev.data;
    if (msg && msg.kind === 'hello') send({ kind: 'state', state: state });
    if (msg && msg.kind === 'armed') { audienceArmed = true; render(); }
  };

  setInterval(function () {
    // Detect the audience window being closed.
    if (audienceWin && audienceWin.closed) { audienceWin = null; audienceArmed = false; }
    renderAudienceStatus();
  }, 2000);

  /* ============================ game loading ============================ */

  var manifest = [];

  function normalizeGame(raw) {
    if (!raw || !Array.isArray(raw.rounds) || raw.rounds.length === 0) {
      throw new Error('Game file needs a non-empty "rounds" array.');
    }
    raw.rounds.forEach(function (r, i) {
      if (!r.question || !Array.isArray(r.answers) || r.answers.length === 0) {
        throw new Error('Round ' + (i + 1) + ' needs "question" and "answers".');
      }
      r.answers = r.answers.slice(0, 8);
      r.multiplier = r.multiplier || 1;
    });
    FeudPoints.fillGamePoints(raw);
    // Highest answers first, like the real board.
    raw.rounds.forEach(function (r) {
      r.answers.sort(function (a, b) { return b.points - a.points; });
    });
    if (raw.fast_money && raw.fast_money.questions) {
      raw.fast_money.target = raw.fast_money.target || 200;
      raw.fast_money.questions = raw.fast_money.questions.slice(0, 5);
      raw.fast_money.questions.forEach(function (q) {
        q.answers.sort(function (a, b) { return b.points - a.points; });
      });
    }
    return raw;
  }

  function useGame(raw, label) {
    try {
      game = normalizeGame(raw);
      state.gameTitle = game.title || label || 'Family Feud';
      el('btn-start-show').disabled = false;
      showLoadError('');
      commit(null);
    } catch (err) {
      game = null;
      el('btn-start-show').disabled = true;
      showLoadError('Could not use "' + label + '": ' + err.message);
    }
  }

  function showLoadError(text) {
    var box = el('load-error');
    box.textContent = text;
    box.style.display = text ? 'block' : 'none';
  }

  function loadManifest() {
    fetch('games/manifest.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (m) {
        manifest = m.games || [];
        var sel = el('game-select');
        sel.innerHTML = '';
        manifest.forEach(function (g, i) {
          var opt = document.createElement('option');
          opt.value = g.file;
          opt.textContent = (i + 1 < 10 ? '0' : '') + (i + 1) + ' — ' + g.title;
          sel.appendChild(opt);
        });
        if (manifest.length) loadGameFile(manifest[0].file);
      })
      .catch(function () {
        showLoadError('Your browser blocked reading local game files. Either run the one-line server ' +
          '(see README: python3 -m http.server, or double-click start.command) or use ' +
          '"Load a game file (.json)…" below — that always works.');
      });
  }

  function loadGameFile(file) {
    fetch('games/' + file)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (raw) { useGame(raw, file); })
      .catch(function (e) { showLoadError('Could not load ' + file + ' (' + e.message + ').'); });
  }

  el('game-select').addEventListener('change', function () { loadGameFile(this.value); });
  el('btn-load-file').addEventListener('click', function () { el('file-input').click(); });
  el('file-input').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { useGame(JSON.parse(reader.result), f.name); }
      catch (e) { showLoadError(f.name + ' is not valid JSON: ' + e.message); }
    };
    reader.readAsText(f);
  });

  /* ============================ stage actions ============================ */

  function startRound(index, fx) {
    var r = game.rounds[index];
    state.roundIndex = index;
    state.round = {
      question: r.question,
      answers: r.answers,
      revealed: r.answers.map(function () { return false; }),
      bank: 0,
      bankAwarded: false,
      multiplier: r.multiplier,
      strikes: 0,
      controlTeam: null
    };
    state.faceoffWinner = null;
    state.stage = 'faceoff';
    commit(fx);
  }

  el('btn-start-show').addEventListener('click', function () {
    if (!game) return;
    state.teams[0].name = (el('team0-name').value.trim() || 'TEAM 1').toUpperCase();
    state.teams[1].name = (el('team1-name').value.trim() || 'TEAM 2').toUpperCase();
    state.teams[0].score = 0;
    state.teams[1].score = 0;
    state.stage = 'ready';
    commit({ cue: 'theme' });
  });

  el('btn-first-round').addEventListener('click', function () {
    startRound(0, { stopCue: 'theme', cue: 'face-off', banner: 'ROUND 1' });
  });

  el('btn-faceoff-buzzer').addEventListener('click', function () {
    commit({ cue: 'strike-buzzer' }); // buzzer only — no X during the face-off
  });

  [0, 1].forEach(function (t) {
    el('btn-faceoff-' + t).addEventListener('click', function () {
      state.faceoffWinner = t;
      state.stage = 'playorpass';
      commit(null);
    });
  });

  el('btn-play').addEventListener('click', function () {
    state.round.controlTeam = state.faceoffWinner;
    state.stage = 'round';
    commit(null);
  });
  el('btn-pass').addEventListener('click', function () {
    state.round.controlTeam = 1 - state.faceoffWinner;
    state.stage = 'round';
    commit(null);
  });

  el('btn-strike').addEventListener('click', function () {
    var r = state.round;
    if (r.strikes >= 3) return;
    r.strikes++;
    if (r.strikes >= 3) state.stage = 'steal';
    commit({ cue: 'strike-buzzer', strikes: r.strikes });
  });

  function awardBank(team, fx) {
    var r = state.round;
    state.teams[team].score += r.bank;
    r.bank = 0;
    r.bankAwarded = true;
    state.stage = 'roundover';
    commit(fx || { cue: 'survey-says' });
  }

  el('btn-award-control').addEventListener('click', function () {
    awardBank(state.round.controlTeam);
  });
  el('btn-steal-good').addEventListener('click', function () {
    awardBank(1 - state.round.controlTeam, { cue: 'survey-says' });
  });
  el('btn-steal-bad').addEventListener('click', function () {
    commit({ cue: 'strike-buzzer' });
    awardBank(state.round.controlTeam);
  });

  Array.prototype.forEach.call(document.querySelectorAll('.award-btn'), function (btn) {
    btn.addEventListener('click', function () {
      if (!state.round || state.round.bank === 0) return;
      awardBank(parseInt(btn.dataset.team, 10));
    });
  });

  el('btn-reveal-rest').addEventListener('click', function () {
    var r = state.round;
    r.revealed = r.revealed.map(function () { return true; });
    commit({ cue: 'reveal' });
  });

  el('btn-next-round').addEventListener('click', function () {
    var next = state.roundIndex + 1;
    if (next >= game.rounds.length) return;
    var mult = game.rounds[next].multiplier;
    var banner = 'ROUND ' + (next + 1) + (mult === 2 ? ' — DOUBLE POINTS' : mult === 3 ? ' — TRIPLE POINTS' : '');
    startRound(next, { cue: 'round-transition', banner: banner });
    // Face-off sting after the transition sting has had its moment.
    setTimeout(function () {
      if (state.stage === 'faceoff') commit({ cue: 'face-off' });
    }, 3200);
  });

  el('btn-goto-fm').addEventListener('click', function () {
    if (!game.fast_money || !game.fast_money.questions || !game.fast_money.questions.length) return;
    var fm = game.fast_money;
    state.fastMoney = {
      target: fm.target,
      playingTeam: null,
      currentPlayer: 0,
      questions: fm.questions,
      players: [
        { answers: fm.questions.map(function () { return null; }) },
        { answers: fm.questions.map(function () { return null; }) }
      ]
    };
    state.round = null;
    state.stage = 'fm-play';
    state.timer = { remaining: 20, running: false, visible: false };
    commit({ cue: 'round-transition', banner: 'FAST MONEY' });
  });

  /* ---------------- fast money: timer ---------------- */

  function startTimer(seconds) {
    clearInterval(timerInterval);
    state.timer = { remaining: seconds, running: true, visible: true };
    commit({ cue: 'clock' });
    timerInterval = setInterval(function () {
      state.timer.remaining--;
      if (state.timer.remaining <= 0) {
        state.timer.remaining = 0;
        state.timer.running = false;
        clearInterval(timerInterval);
        commit({ stopCue: 'clock', cue: 'strike-buzzer' });
      } else {
        commit(null);
      }
    }, 1000);
  }

  el('btn-fm-timer-20').addEventListener('click', function () { startTimer(20); });
  el('btn-fm-timer-25').addEventListener('click', function () { startTimer(25); });
  el('btn-fm-timer-stop').addEventListener('click', function () {
    clearInterval(timerInterval);
    if (state.timer) state.timer.running = false;
    commit({ stopCue: 'clock' });
  });

  /* ---------------- fast money: answer entry ---------------- */

  function normText(t) { return (t || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function fmRecord(qi, text, points) {
    var fm = state.fastMoney;
    var p = fm.currentPlayer;
    if (p === 1) {
      var other = fm.players[0].answers[qi];
      if (other && !other.duplicate && normText(other.text) === normText(text) && normText(text) !== '') {
        // Duplicate! Sound fires; host asks for another answer. Nothing recorded.
        commit({ cue: 'duplicate' });
        flashFmDup(qi);
        return;
      }
    }
    fm.players[p].answers[qi] = {
      text: text || '(no answer)',
      points: points || 0,
      duplicate: false,
      textRevealed: false,
      pointsRevealed: false
    };
    commit(null);
  }

  var fmDupFlash = {};
  function flashFmDup(qi) {
    fmDupFlash[qi] = true;
    renderFmEntry();
    setTimeout(function () { delete fmDupFlash[qi]; renderFmEntry(); }, 2500);
  }

  el('btn-fm-next-player').addEventListener('click', function () {
    state.fastMoney.currentPlayer = 1;
    clearInterval(timerInterval);
    state.timer = { remaining: 25, running: false, visible: false };
    commit({ stopCue: 'clock' });
  });

  el('btn-fm-to-reveal').addEventListener('click', function () {
    clearInterval(timerInterval);
    if (state.timer) { state.timer.running = false; state.timer.visible = false; }
    state.stage = 'fm-reveal';
    commit({ stopCue: 'clock' });
  });

  /* ---------------- fast money: the big reveal ---------------- */

  function fmRevealText(pi, qi) {
    var a = state.fastMoney.players[pi].answers[qi];
    if (!a || a.textRevealed) return;
    a.textRevealed = true;
    commit({ cue: 'fm-reveal' });
  }

  function fmRevealPoints(pi, qi) {
    var a = state.fastMoney.players[pi].answers[qi];
    if (!a || !a.textRevealed || a.pointsRevealed) return;
    a.pointsRevealed = true;
    var fx = { cue: a.points > 0 ? 'correct-ding' : 'strike-buzzer' };
    // Crossing the target = the win moment.
    var total = fmTotal();
    if (total >= state.fastMoney.target) fx = { cue: 'win' };
    commit(fx);
  }

  function fmTotal() {
    var total = 0;
    state.fastMoney.players.forEach(function (p) {
      p.answers.forEach(function (a) {
        if (a && a.pointsRevealed) total += a.points;
      });
    });
    return total;
  }

  /* ---------------- finish ---------------- */

  el('btn-declare-winner').addEventListener('click', function () {
    var t0 = state.teams[0].score, t1 = state.teams[1].score;
    state.winner = t1 > t0 ? 1 : 0;
    state.stage = 'gameover';
    clearInterval(timerInterval);
    commit({ stopAll: true, cue: 'win' });
    setTimeout(function () {
      if (state.stage === 'gameover') commit({ cue: 'theme' });
    }, 2500);
  });

  el('btn-play-theme-again').addEventListener('click', function () {
    commit({ cue: 'theme' });
  });

  el('btn-new-game').addEventListener('click', function () {
    if (state.stage !== 'setup' && !confirm('Reset everything and load a new game?')) return;
    clearInterval(timerInterval);
    var names = [el('team0-name').value, el('team1-name').value];
    state = freshState();
    el('team0-name').value = names[0];
    el('team1-name').value = names[1];
    if (game) state.gameTitle = game.title || '';
    commit({ stopAll: true });
  });

  /* ---------------- misc controls ---------------- */

  el('btn-open-audience').addEventListener('click', function () {
    audienceWin = window.open('audience.html', 'feud-audience', 'width=1280,height=720');
    audienceArmed = false;
    setTimeout(function () { send({ kind: 'state', state: state }); }, 800);
    renderAudienceStatus();
  });

  el('btn-toggle-question').addEventListener('click', function () {
    state.showQuestion = !state.showQuestion;
    commit(null);
  });

  Array.prototype.forEach.call(document.querySelectorAll('.cue-test'), function (btn) {
    btn.addEventListener('click', function () { commit({ cue: btn.dataset.cue }); });
  });
  el('btn-stop-sounds').addEventListener('click', function () { commit({ stopAll: true }); });

  Array.prototype.forEach.call(document.querySelectorAll('.score-set'), function (btn) {
    btn.addEventListener('click', function () {
      var t = parseInt(btn.dataset.team, 10);
      var v = parseInt(document.querySelector('.score-input[data-team="' + t + '"]').value, 10);
      if (!isNaN(v)) { state.teams[t].score = v; commit(null); }
    });
  });

  /* ---------------- reveal answers (host answer grid) ---------------- */

  function revealAnswer(i) {
    var r = state.round;
    if (!r || r.revealed[i]) return;
    var scoringStage = state.stage === 'faceoff' || state.stage === 'round' || state.stage === 'steal';
    r.revealed[i] = true;
    if (scoringStage && !r.bankAwarded) {
      r.bank += r.answers[i].points * r.multiplier;
      commit({ cue: 'correct-ding' });
    } else {
      commit({ cue: 'reveal' });
    }
    // Board cleared during normal play → move to the award step automatically
    // (presentation only; awarding stays manual).
    if (state.stage === 'round' && r.revealed.every(Boolean)) {
      state.stage = 'roundover';
      commit(null);
    }
  }

  /* ============================ rendering ============================ */

  function el(id) { return document.getElementById(id); }

  var STAGE_LABELS = {
    setup: 'Setup', ready: 'Show open', faceoff: 'Face-off', playorpass: 'Play or pass',
    round: 'Round play', steal: 'Steal!', roundover: 'Round over',
    'fm-play': 'Fast money — answers', 'fm-reveal': 'Fast money — reveal', gameover: 'Game over'
  };

  function renderAudienceStatus() {
    var s = el('audience-status');
    if (!audienceLive()) { s.textContent = 'Audience window: not open'; s.className = ''; }
    else if (!audienceArmed) { s.textContent = 'Audience window: open — click it once to enable sound'; s.className = ''; }
    else { s.textContent = 'Audience window: connected ✓'; s.className = 'ok'; }
  }

  function render() {
    var s = state.stage;
    var stageName = STAGE_LABELS[s] || s;
    if (s !== 'setup' && s !== 'ready' && state.roundIndex >= 0 && state.round) {
      stageName = 'Round ' + (state.roundIndex + 1) + ' · ' + stageName;
    }
    el('stage-indicator').textContent = stageName;

    Array.prototype.forEach.call(document.querySelectorAll('.stage-block'), function (b) {
      b.classList.toggle('active', b.dataset.stage === s);
    });

    // Face-off buttons carry team names
    el('btn-faceoff-0').textContent = state.teams[0].name;
    el('btn-faceoff-1').textContent = state.teams[1].name;
    if (state.faceoffWinner !== null) {
      el('pop-question').textContent = state.teams[state.faceoffWinner].name + ' won the face-off. Play or pass?';
    }

    if (state.round) {
      var r = state.round;
      el('round-hint').textContent = state.teams[r.controlTeam === null ? 0 : r.controlTeam].name +
        ' has the board. Reveal correct answers on the grid; wrong answers get a STRIKE.';
      el('btn-award-control').textContent = r.controlTeam !== null
        ? 'Board cleared — award bank to ' + state.teams[r.controlTeam].name
        : 'Award bank';
      el('roundover-hint').textContent = r.bankAwarded
        ? 'Bank awarded. Reveal the rest of the board, then continue.'
        : 'Round finished — award the bank with the buttons on the right.';
    }

    var isLastRound = game && state.roundIndex >= game.rounds.length - 1;
    el('btn-next-round').style.display = isLastRound ? 'none' : '';
    el('btn-goto-fm').style.display = (game && game.fast_money && game.fast_money.questions && game.fast_money.questions.length) ? '' : 'none';

    renderQuestionPanel();
    renderScores();
    renderFmEntry();
    renderFmReveal();
    renderAudienceStatus();

    el('btn-toggle-question').textContent = state.showQuestion
      ? 'Hide question on audience screen' : 'Show question on audience screen';
  }

  function renderQuestionPanel() {
    var q = el('host-question');
    var grid = el('answers-grid');
    if (!state.round) {
      q.textContent = game ? (state.gameTitle + ' — loaded. ' + game.rounds.length + ' rounds' +
        (game.fast_money ? ' + fast money.' : '.')) : 'Load a game to begin.';
      grid.innerHTML = '';
      return;
    }
    var r = state.round;
    q.textContent = 'R' + (state.roundIndex + 1) +
      (r.multiplier > 1 ? ' (×' + r.multiplier + ')' : '') + ': ' + r.question;
    grid.innerHTML = '';
    r.answers.forEach(function (a, i) {
      var btn = document.createElement('button');
      btn.className = 'ans-btn' + (r.revealed[i] ? ' revealed' : '');
      btn.innerHTML = '<span><span class="anum">' + (i + 1) + '</span>' +
        escapeHtml(a.text) + '</span><span class="apts">' + a.points + '</span>';
      btn.disabled = r.revealed[i];
      btn.addEventListener('click', function () { revealAnswer(i); });
      grid.appendChild(btn);
    });
  }

  function renderScores() {
    el('bank-line').textContent = 'BANK: ' + (state.round ? state.round.bank : 0) +
      (state.round && state.round.multiplier > 1 ? '  (×' + state.round.multiplier + ' applied)' : '');
    [0, 1].forEach(function (t) {
      var box = el('tbox-' + t);
      box.querySelector('.tname').textContent = state.teams[t].name;
      var input = box.querySelector('.score-input');
      if (document.activeElement !== input) input.value = state.teams[t].score;
      var strikes = '';
      if (state.round && state.round.controlTeam === t) {
        for (var k = 0; k < state.round.strikes; k++) strikes += 'X ';
      }
      box.querySelector('.strikes').textContent = strikes;
      box.classList.toggle('control', !!(state.round && state.round.controlTeam === t));
      box.querySelector('.award-btn').textContent = 'Award bank ➜ ' + state.teams[t].name;
    });
  }

  function renderFmEntry() {
    var wrap = el('fm-entry');
    if (state.stage !== 'fm-play' || !state.fastMoney) { wrap.innerHTML = ''; return; }
    // Don't rebuild (and wipe) the panel while the host is typing in it —
    // the ticking clock commits state every second.
    if (wrap.contains(document.activeElement)) return;
    var fm = state.fastMoney;

    if (fm.playingTeam === null) {
      wrap.innerHTML = '<div class="sub">Which team plays Fast Money?</div>';
      var row = document.createElement('div');
      row.className = 'btn-row';
      [0, 1].forEach(function (t) {
        var b = document.createElement('button');
        b.className = 'primary';
        b.textContent = state.teams[t].name;
        b.addEventListener('click', function () { fm.playingTeam = t; commit(null); });
        row.appendChild(b);
      });
      wrap.appendChild(row);
      el('fm-play-hint').textContent = 'Pick the team, send Player 2 out of earshot, then start the clock for Player 1.';
      el('btn-fm-next-player').style.display = 'none';
      el('btn-fm-to-reveal').style.display = 'none';
      return;
    }

    var p = fm.currentPlayer;
    el('fm-play-hint').textContent = 'PLAYER ' + (p + 1) + ' of ' + state.teams[fm.playingTeam].name +
      ' — read the 5 questions fast. Click the matching survey answer (or type it) as they answer. ' +
      (p === 1 ? 'Duplicates buzz automatically — ask for another answer.' : 'The audience screen shows nothing yet.');
    el('btn-fm-next-player').style.display = p === 0 ? '' : 'none';
    el('btn-fm-to-reveal').style.display = p === 1 ? '' : 'none';

    wrap.innerHTML = '';
    fm.questions.forEach(function (q, qi) {
      var entered = fm.players[p].answers[qi];
      var box = document.createElement('div');
      box.className = 'fm-q';
      var head = document.createElement('div');
      head.className = 'q-text';
      head.textContent = 'Q' + (qi + 1) + ': ' + q.question;
      box.appendChild(head);

      var abox = document.createElement('div');
      abox.className = 'fm-answers';
      q.answers.forEach(function (a) {
        var b = document.createElement('button');
        b.textContent = a.text + ' · ' + a.points;
        b.addEventListener('click', function () { fmRecord(qi, a.text, a.points); });
        abox.appendChild(b);
      });
      var none = document.createElement('button');
      none.className = 'bad';
      none.textContent = 'Not on board / pass · 0';
      none.addEventListener('click', function () { fmRecord(qi, '(not on board)', 0); });
      abox.appendChild(none);
      box.appendChild(abox);

      var custom = document.createElement('div');
      custom.className = 'custom-row';
      custom.innerHTML = '<input type="text" placeholder="their exact words"><input type="number" placeholder="pts" min="0" max="99"><button>Add</button>';
      var ti = custom.querySelector('input[type=text]');
      var pi2 = custom.querySelector('input[type=number]');
      custom.querySelector('button').addEventListener('click', function () {
        fmRecord(qi, ti.value.trim(), parseInt(pi2.value, 10) || 0);
      });
      box.appendChild(custom);

      var info = document.createElement('div');
      info.className = 'entered' + (fmDupFlash[qi] ? ' dup' : '');
      info.textContent = fmDupFlash[qi]
        ? 'DUPLICATE — ask for another answer!'
        : (entered ? 'Recorded: ' + entered.text + ' (' + entered.points + ' pts)' : '');
      box.appendChild(info);
      wrap.appendChild(box);
    });
  }

  function renderFmReveal() {
    var grid = el('fm-reveal-grid');
    if (state.stage !== 'fm-reveal' || !state.fastMoney) { grid.innerHTML = ''; return; }
    var fm = state.fastMoney;
    grid.innerHTML = '';
    [0, 1].forEach(function (pi) {
      fm.questions.forEach(function (q, qi) {
        var a = fm.players[pi].answers[qi];
        var cell = document.createElement('div');
        cell.className = 'fm-reveal-cell';
        var who = 'P' + (pi + 1) + ' · Q' + (qi + 1);
        var what = a ? a.text + ' — ' + a.points + ' pts' : '(nothing recorded)';
        cell.innerHTML = '<div class="who">' + who + '</div><div class="what">' + escapeHtml(what) + '</div>';
        var row = document.createElement('div');
        row.className = 'btn-row';
        var b1 = document.createElement('button');
        b1.textContent = 'Reveal answer';
        b1.disabled = !a || a.textRevealed;
        b1.addEventListener('click', function () { fmRevealText(pi, qi); });
        var b2 = document.createElement('button');
        b2.className = 'good';
        b2.textContent = 'Reveal points';
        b2.disabled = !a || !a.textRevealed || a.pointsRevealed;
        b2.addEventListener('click', function () { fmRevealPoints(pi, qi); });
        row.appendChild(b1);
        row.appendChild(b2);
        cell.appendChild(row);
        grid.appendChild(cell);
      });
    });
    var totalNote = document.createElement('div');
    totalNote.className = 'hint';
    totalNote.style.gridColumn = '1 / -1';
    totalNote.textContent = 'Running total: ' + fmTotal() + ' / ' + fm.target;
    grid.appendChild(totalNote);
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ============================== boot ============================== */

  loadManifest();
  render();
})();
