/* Deterministic audio cues. Every cue name maps to exactly one file in sounds/.
 * To swap a sound, drop a new file in sounds/ with the same name (or edit this map). */
(function (global) {
  'use strict';

  var CUES = {
    'theme':            'sounds/theme.mp3',            // show open / celebration music
    'survey-says':      'sounds/survey-says.wav',      // bank awarded sting
    'reveal':           'sounds/reveal.wav',           // board flip bell (non-scoring reveals)
    'correct-ding':     'sounds/correct-ding.mp3',     // correct answer ding
    'strike-buzzer':    'sounds/strike-buzzer.wav',    // wrong answer / strike buzzer
    'duplicate':        'sounds/duplicate.mp3',        // fast money duplicate answer
    'face-off':         'sounds/face-off.mp3',         // face-off tension sting
    'round-transition': 'sounds/round-transition.mp3', // between rounds
    'fm-reveal':        'sounds/fm-reveal.mp3',        // fast money answer text reveal
    'clock':            'sounds/clock.mp3',            // fast money ticking clock (looped)
    'win':              'sounds/win.mp3'               // win / applause
  };

  var players = {};   // cue -> Audio element (reused)
  var armed = false;  // browsers require one user gesture before audio can play

  function getPlayer(cue) {
    if (!players[cue]) {
      var a = new Audio(CUES[cue]);
      a.preload = 'auto';
      players[cue] = a;
    }
    return players[cue];
  }

  function arm() {
    // Called from a click handler: prime every player so later plays are allowed.
    armed = true;
    Object.keys(CUES).forEach(function (cue) { getPlayer(cue).load(); });
  }

  function play(cue) {
    if (!CUES[cue]) return;
    try {
      // Long cues (theme, clock) should not stack on themselves or each other.
      if (cue === 'theme' || cue === 'clock') stopLong();
      var a = getPlayer(cue);
      a.loop = (cue === 'clock');
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () { /* not armed yet — ignore */ });
    } catch (e) { /* never let audio break the game */ }
  }

  function stop(cue) {
    var a = players[cue];
    if (a) { a.pause(); a.currentTime = 0; }
  }

  function stopLong() { stop('theme'); stop('clock'); }
  function stopAll() { Object.keys(players).forEach(stop); }

  global.FeudSounds = { CUES: CUES, play: play, stop: stop, stopLong: stopLong, stopAll: stopAll, arm: arm, isArmed: function () { return armed; } };
})(window);
