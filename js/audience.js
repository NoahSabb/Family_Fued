/* Audience view: a pure renderer. The host window owns all game state and sends
 * full snapshots + sound/fx events via postMessage (and BroadcastChannel as a
 * backup path). This page never decides game logic. */
(function () {
  'use strict';

  var state = null;
  var renderedRoundKey = null; // rebuild slots only when the round changes
  var hostWindow = null;

  var el = {
    splash: document.getElementById('splash'),
    title: document.getElementById('title-screen'),
    titleSub: document.getElementById('title-sub'),
    titleTeams: document.getElementById('title-teams'),
    scorebar: document.getElementById('scorebar'),
    plates: [document.getElementById('plate-0'), document.getElementById('plate-1')],
    bankValue: document.getElementById('bank-value'),
    multBadge: document.getElementById('multiplier-badge'),
    questionBar: document.getElementById('question-bar'),
    boardFrame: document.getElementById('board-frame'),
    board: document.getElementById('board'),
    strikeOverlay: document.getElementById('strike-overlay'),
    roundBanner: document.getElementById('round-banner'),
    roundBannerText: document.querySelector('#round-banner .rb-text'),
    fastmoney: document.getElementById('fastmoney'),
    fmTimer: document.getElementById('fm-timer'),
    fmGrid: document.getElementById('fm-grid'),
    fmTarget: document.getElementById('fm-target'),
    fmTotalPlate: document.getElementById('fm-total-plate'),
    fmTotal: document.getElementById('fm-total'),
    winner: document.getElementById('winner-screen'),
    winnerName: document.querySelector('#winner-screen .wname'),
    winnerScore: document.querySelector('#winner-screen .wscore')
  };

  /* ---------------- communication ---------------- */

  var bc = null;
  try { bc = new BroadcastChannel('family-feud'); } catch (e) { /* unsupported: fine */ }

  function sendToHost(msg) {
    try { if (hostWindow) hostWindow.postMessage(msg, '*'); } catch (e) {}
    try { if (window.opener) window.opener.postMessage(msg, '*'); } catch (e) {}
    try { if (bc) bc.postMessage(msg); } catch (e) {}
  }

  function handleMessage(msg) {
    if (!msg || !msg.kind) return;
    if (msg.kind === 'state') { state = msg.state; render(); }
    else if (msg.kind === 'fx') { runFx(msg.fx); }
    else if (msg.kind === 'ping') { sendToHost({ kind: 'hello', armed: FeudSounds.isArmed() }); }
  }

  window.addEventListener('message', function (ev) {
    if (ev.source && ev.source !== window) hostWindow = ev.source;
    handleMessage(ev.data);
  });
  if (bc) bc.onmessage = function (ev) { handleMessage(ev.data); };

  // Announce ourselves so the host re-sends current state (also covers reloads).
  sendToHost({ kind: 'hello', armed: false });

  /* ---------------- splash / arming ---------------- */

  el.splash.addEventListener('click', function () {
    FeudSounds.arm();
    el.splash.style.display = 'none';
    sendToHost({ kind: 'armed' });
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  });

  /* ---------------- fx (sounds + transient visuals) ---------------- */

  var strikeTimer = null;

  function runFx(fx) {
    if (!fx) return;
    if (fx.cue) FeudSounds.play(fx.cue);
    if (fx.stopCue) FeudSounds.stop(fx.stopCue);
    if (fx.stopAll) FeudSounds.stopAll();

    if (fx.strikes) {
      el.strikeOverlay.innerHTML = '';
      for (var i = 0; i < fx.strikes; i++) {
        var x = document.createElement('div');
        x.className = 'bigx';
        x.textContent = 'X';
        el.strikeOverlay.appendChild(x);
      }
      el.strikeOverlay.classList.add('visible');
      clearTimeout(strikeTimer);
      strikeTimer = setTimeout(function () {
        el.strikeOverlay.classList.remove('visible');
      }, 1800);
    }

    if (fx.banner) {
      el.roundBannerText.textContent = fx.banner;
      el.roundBanner.classList.add('visible');
      setTimeout(function () { el.roundBanner.classList.remove('visible'); }, 2600);
    }
  }

  /* ---------------- rendering ---------------- */

  function setVisible(node, visible) {
    node.classList.toggle('visible', !!visible);
  }

  function render() {
    if (!state) return;
    var s = state.stage;

    // Screen routing
    setVisible(el.title, s === 'setup' || s === 'ready');
    setVisible(el.fastmoney, s === 'fm-play' || s === 'fm-reveal');
    setVisible(el.winner, s === 'gameover');
    var boardStages = { faceoff: 1, playorpass: 1, round: 1, steal: 1, roundover: 1 };
    var showBoard = !!boardStages[s];
    el.scorebar.style.visibility = showBoard ? 'visible' : 'hidden';
    el.questionBar.style.visibility = showBoard ? 'visible' : 'hidden';
    el.boardFrame.style.visibility = showBoard ? 'visible' : 'hidden';

    // Title screen
    el.titleSub.textContent = state.gameTitle || 'Get ready to play!';
    el.titleTeams.textContent = state.teams[0].name + '   vs   ' + state.teams[1].name;

    // Scoreboard
    state.teams.forEach(function (t, i) {
      var plate = el.plates[i];
      plate.querySelector('.tname').textContent = t.name;
      plate.querySelector('.tscore').textContent = t.score;
      var inControl = showBoard && state.round && state.round.controlTeam === i && s !== 'faceoff';
      plate.classList.toggle('control', !!inControl);
      var strikes = '';
      if (state.round && s !== 'faceoff') {
        var n = (state.round.controlTeam === i) ? state.round.strikes : 0;
        for (var k = 0; k < n; k++) strikes += 'X';
      }
      plate.querySelector('.strikes-mini').textContent = strikes;
    });

    // Round board
    if (state.round) {
      var r = state.round;
      el.bankValue.textContent = r.bank;
      el.multBadge.textContent = r.multiplier === 2 ? 'DOUBLE POINTS' : r.multiplier === 3 ? 'TRIPLE POINTS' : '';
      el.multBadge.classList.toggle('visible', r.multiplier > 1);
      el.questionBar.textContent = r.question;
      el.questionBar.classList.toggle('hidden-q', !state.showQuestion);
      renderSlots(r);
    }

    renderFastMoney();
    renderWinner();
  }

  function renderSlots(r) {
    var roundKey = state.gameTitle + '|' + state.roundIndex;
    var slotCount = Math.max(8, Math.ceil(r.answers.length / 2) * 2);
    if (renderedRoundKey !== roundKey) {
      renderedRoundKey = roundKey;
      el.board.innerHTML = '';
      for (var i = 0; i < slotCount; i++) {
        var slot = document.createElement('div');
        slot.className = 'slot';
        slot.id = 'slot-' + i;
        if (i < r.answers.length) {
          slot.innerHTML =
            '<div class="card">' +
              '<div class="face front"><div class="num">' + (i + 1) + '</div></div>' +
              '<div class="face back"><div class="ans"></div><div class="pts"></div></div>' +
            '</div>';
          slot.querySelector('.ans').textContent = r.answers[i].text;
          slot.querySelector('.pts').textContent = r.answers[i].points;
        } else {
          slot.className = 'slot empty-slot';
        }
        el.board.appendChild(slot);
      }
      // 4 rows per column; grid flows column-first like the show
      el.board.style.gridTemplateRows = 'repeat(' + Math.max(4, slotCount / 2) + ', 1fr)';
    }
    r.revealed.forEach(function (rev, i) {
      var slot = document.getElementById('slot-' + i);
      if (slot) slot.classList.toggle('flipped', !!rev);
    });
  }

  function renderFastMoney() {
    var fm = state.fastMoney;
    if (!fm || !(state.stage === 'fm-play' || state.stage === 'fm-reveal')) return;

    el.fmTarget.textContent = fm.target + ' POINTS WINS' +
      (fm.playingTeam === null || fm.playingTeam === undefined ? '' : '  •  ' + state.teams[fm.playingTeam].name);
    el.fmGrid.innerHTML = '';
    var total = 0;
    fm.questions.forEach(function (q, qi) {
      var row = document.createElement('div');
      row.className = 'fm-row';
      [0, 1].forEach(function (pi) {
        var a = fm.players[pi].answers[qi];
        var txt = document.createElement('div');
        txt.className = 'fm-cell';
        var pts = document.createElement('div');
        pts.className = 'fm-cell pts';
        if (a) {
          if (a.textRevealed) {
            txt.textContent = a.duplicate ? a.text + ' (DUPLICATE)' : a.text;
            txt.classList.add('revealed');
            if (a.duplicate) txt.classList.add('dup');
          }
          if (a.pointsRevealed) {
            pts.textContent = a.points;
            pts.classList.add('revealed');
            total += a.points;
          }
        }
        row.appendChild(txt);
        row.appendChild(pts);
      });
      el.fmGrid.appendChild(row);
    });
    el.fmTotal.textContent = total;
    el.fmTotalPlate.classList.toggle('winner', total >= fm.target);

    // Timer
    var t = state.timer;
    el.fmTimer.classList.toggle('visible', !!(t && t.visible));
    if (t) {
      el.fmTimer.textContent = t.remaining;
      el.fmTimer.classList.toggle('urgent', t.remaining <= 5 && t.running);
    }
  }

  /* Preview hook: audience.html#state=<base64 JSON> renders that state once.
   * Used for testing the board without a host window. */
  try {
    if (location.hash.indexOf('#state=') === 0) {
      state = JSON.parse(atob(location.hash.slice(7)));
      el.splash.style.display = 'none';
      setTimeout(render, 50);
    }
  } catch (e) { /* bad hash — ignore */ }

  function renderWinner() {
    if (state.stage !== 'gameover') return;
    var w = state.winner;
    if (w === null || w === undefined) return;
    el.winnerName.textContent = state.teams[w].name;
    el.winnerScore.textContent =
      state.teams[0].name + ' ' + state.teams[0].score + '  —  ' + state.teams[1].name + ' ' + state.teams[1].score;
  }
})();
