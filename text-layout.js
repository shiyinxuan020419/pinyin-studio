(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LessonTextLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CANNOT_START = new Set(Array.from('，。！？、；：）】》”’'));
  var CANNOT_END = new Set(Array.from('（【《“‘'));
  var EPSILON = 0.000001;

  function round(value) {
    return Math.round(value * 10000) / 10000;
  }

  function positiveNumber(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new RangeError(name + ' must be a positive finite number');
    }
    return number;
  }

  /** The complete, bounded set of permitted font sizes. */
  function fontCandidates(base) {
    base = positiveNumber(base, 'base');
    return [base, base * 0.9375, base * 0.875].map(round);
  }

  /**
   * Measurements may carry additional fields (for example, the full layout).
   * The selected measurement is copied, never mutated.
   */
  function chooseFont(measurements, bodyRect, tolerance) {
    if (!Array.isArray(measurements) || measurements.length === 0) {
      throw new RangeError('At least one font measurement is required');
    }
    var allowance = tolerance === undefined ? 0.5 : Number(tolerance);
    if (!Number.isFinite(allowance) || allowance < 0) {
      throw new RangeError('tolerance must be a nonnegative finite number');
    }
    var candidates = measurements.slice().sort(function (a, b) {
      return b.fontSize - a.fontSize;
    });
    function fits(item) {
      return Number.isFinite(item.width) && Number.isFinite(item.height) &&
        item.width <= bodyRect.width + allowance &&
        item.height <= bodyRect.height + allowance;
    }
    var selected = candidates.find(fits);
    return Object.assign({}, selected || candidates[candidates.length - 1], {
      overflow: !selected
    });
  }

  /**
   * Token format: {c: one Unicode code point, i: original UTF-16 index, pinyin}.
   * x/pinyinX are relative to the line; y is relative to the complete layout.
   * Han and punctuation cells share a fontSize-wide grid. A pronunciation can
   * extend over empty pronunciation space without widening those cells.
   */
  function layoutTokens(tokens, options) {
    options = options || {};
    var fontSize = positiveNumber(options.fontSize, 'fontSize');
    var availableWidth = Number(options.width);
    var lineGap = options.lineGap === undefined ? 0 : Number(options.lineGap);
    if (!Number.isFinite(availableWidth) || availableWidth < 0) {
      throw new RangeError('width must be a nonnegative finite number');
    }
    if (!Number.isFinite(lineGap) || lineGap < 0) {
      throw new RangeError('lineGap must be a nonnegative finite number');
    }
    if (!Array.isArray(tokens)) throw new TypeError('tokens must be an array');

    var pinyinFontSize = fontSize * 18 / 32;
    var pinyinGap = fontSize * 4 / 32;
    var lineHeight = fontSize * 1.6875;
    var pronunciationGap = fontSize * 2 / 32;
    var measuredPinyin = new Map();

    function pinyinWidth(pinyin) {
      if (!pinyin) return 0;
      if (measuredPinyin.has(pinyin)) return measuredPinyin.get(pinyin);
      if (typeof options.measurePinyin !== 'function') {
        throw new TypeError('measurePinyin is required for annotated tokens');
      }
      var measurement = options.measurePinyin(pinyin, pinyinFontSize);
      var width = Number(typeof measurement === 'object' && measurement !== null
        ? measurement.width : measurement);
      if (!Number.isFinite(width) || width < 0) {
        throw new RangeError('measurePinyin must return a nonnegative width');
      }
      measuredPinyin.set(pinyin, width);
      return width;
    }

    function measureLine(source) {
      var cursor = 0;
      var extent = 0;
      var lastPinyinRight = null;
      var items = source.map(function (token) {
        var pinyin = token.pinyin || '';
        var readingWidth = pinyinWidth(pinyin);
        var x = cursor;
        var readingX = x + (fontSize - readingWidth) / 2;
        if (pinyin) {
          // Keep the first visible pronunciation inside the left boundary.
          var shift = Math.max(0, -readingX);
          // Intervening unannotated cells remain usable pronunciation space.
          if (lastPinyinRight !== null) {
            shift = Math.max(shift, lastPinyinRight + pronunciationGap - readingX);
          }
          x += shift;
          readingX += shift;
          lastPinyinRight = readingX + readingWidth;
          extent = Math.max(extent, lastPinyinRight);
        }
        cursor = x + fontSize;
        extent = Math.max(extent, cursor);
        return Object.assign({}, token, {
          pinyin: pinyin,
          x: round(x),
          width: round(fontSize),
          pinyinX: pinyin ? round(readingX) : null,
          pinyinWidth: round(readingWidth)
        });
      });
      return {tokens: items, width: round(extent), height: round(lineHeight)};
    }

    var paragraphs = [[]];
    for (var t = 0; t < tokens.length; t += 1) {
      var token = tokens[t];
      if (token.c === '\n' || token.c === '\r' || token.c === '\r\n') {
        paragraphs.push([]);
        // Imported CRLF is one hard break, not an extra empty paragraph.
        if (token.c === '\r' && tokens[t + 1] && tokens[t + 1].c === '\n') t += 1;
      } else {
        paragraphs[paragraphs.length - 1].push(token);
      }
    }

    var lines = [];
    paragraphs.forEach(function (paragraph) {
      if (paragraph.length === 0) {
        lines.push(measureLine([]));
        return;
      }
      var start = 0;
      while (start < paragraph.length) {
        var end = start;
        while (end < paragraph.length) {
          var candidate = measureLine(paragraph.slice(start, end + 1));
          if (candidate.width > availableWidth + EPSILON) break;
          end += 1;
        }
        // An oversized single unit still renders and retains its source index.
        if (end === start) end = start + 1;

        if (end < paragraph.length) {
          var preferredEnd = end;
          while (preferredEnd > start &&
            (CANNOT_END.has(paragraph[preferredEnd - 1].c) ||
             CANNOT_START.has(paragraph[preferredEnd].c))) {
            preferredEnd -= 1;
          }
          // Impossible narrow cases retain all characters, in source order.
          if (preferredEnd > start) end = preferredEnd;
        }
        lines.push(measureLine(paragraph.slice(start, end)));
        start = end;
      }
    });

    var width = 0;
    lines.forEach(function (line, index) {
      line.y = round(index * (lineHeight + lineGap));
      width = Math.max(width, line.width);
    });
    return {
      lines: lines,
      fontSize: round(fontSize),
      pinyinFontSize: round(pinyinFontSize),
      pinyinGap: round(pinyinGap),
      lineHeight: round(lineHeight),
      lineGap: round(lineGap),
      width: round(width),
      height: round(lines.length * lineHeight + Math.max(0, lines.length - 1) * lineGap),
      rowCount: lines.length
    };
  }

  return Object.freeze({
    fontCandidates: fontCandidates,
    chooseFont: chooseFont,
    layoutTokens: layoutTokens
  });
});
