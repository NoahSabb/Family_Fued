/* Point-spread generator, ported from Friendly-Feud scripts/point_generator.rb.
 * Top answer gets a random 40–60% of 100; each following answer gets ~66% of the
 * previous one. Used only when a game file provides answers without points. */
(function (global) {
  'use strict';

  function generatePoints(count, opts) {
    opts = opts || {};
    var maxNum = opts.maxNum || 100;
    var maxPer = opts.maxPer || 60;
    var minPer = opts.minPer || 40;
    var decrease = opts.decrease || 66;

    var points = [];
    var lastPer = 0;
    for (var i = 0; i < count; i++) {
      var newPer = i === 0
        ? minPer + Math.random() * (maxPer - minPer)
        : (decrease / 100) * lastPer;
      var val = Math.max(1, Math.floor((newPer / 100) * maxNum));
      lastPer = newPer;
      points.push(val);
    }
    return points;
  }

  /* Fill in missing point values on a parsed game object, in place. */
  function fillGamePoints(game) {
    (game.rounds || []).forEach(function (round) {
      var missing = (round.answers || []).some(function (a) { return typeof a.points !== 'number'; });
      if (missing) {
        var pts = generatePoints(round.answers.length);
        round.answers.forEach(function (a, i) {
          if (typeof a.points !== 'number') a.points = pts[i];
        });
      }
    });
    if (game.fast_money && game.fast_money.questions) {
      game.fast_money.questions.forEach(function (q) {
        var missing = (q.answers || []).some(function (a) { return typeof a.points !== 'number'; });
        if (missing) {
          var pts = generatePoints(q.answers.length);
          q.answers.forEach(function (a, i) {
            if (typeof a.points !== 'number') a.points = pts[i];
          });
        }
      });
    }
    return game;
  }

  global.FeudPoints = { generatePoints: generatePoints, fillGamePoints: fillGamePoints };
})(window);
