(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LessonTitleLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FONT_SIZE = 72;
  var PINYIN_SIZE = 36;
  var BASE_ADVANCE = 79.2;
  var PINYIN_GAP = 7.2;
  var LINE_HEIGHT = 106;
  var LINE_GAP = 16;
  var EPSILON = 0.000001;

  function round(value) {
    return Math.round(value * 1000000) / 1000000;
  }

  /**
   * Lays out a title in logical design coordinates.
   *
   * A single advance is shared by every Han cell in the complete title.
   * Pinyin can use the space above unannotated cells. Hard breaks interrupt
   * the pronunciation adjacency check; soft wraps keep the global advance.
   * Token x and pinyinX are left edges relative to their line, while line y
   * is relative to the title. A line may shift right as a whole to keep its
   * first wide pronunciation inside the left boundary.
   */
  function layoutTokens(tokens, options) {
    options = options || {};
    if (!Array.isArray(tokens)) throw new TypeError('tokens must be an array');
    var availableWidth = Number(options.width);
    if (!Number.isFinite(availableWidth) || availableWidth < 0) {
      throw new RangeError('width must be a nonnegative finite number');
    }

    var measuredPinyin = new Map();
    function measure(pinyin) {
      if (!pinyin) return 0;
      if (measuredPinyin.has(pinyin)) return measuredPinyin.get(pinyin);
      if (typeof options.measurePinyin !== 'function') {
        throw new TypeError('measurePinyin is required for annotated tokens');
      }
      var result = options.measurePinyin(pinyin, PINYIN_SIZE);
      var width = Number(typeof result === 'object' && result !== null
        ? result.width : result);
      if (!Number.isFinite(width) || width < 0) {
        throw new RangeError('measurePinyin must return a nonnegative width');
      }
      measuredPinyin.set(pinyin, width);
      return width;
    }

    var paragraphs = [[]];
    for (var i = 0; i < tokens.length; i += 1) {
      var token = tokens[i];
      if (!token || typeof token.c !== 'string') {
        throw new TypeError('Each token must contain a string c');
      }
      if (token.c === '\n' || token.c === '\r' || token.c === '\r\n') {
        paragraphs.push([]);
        if (token.c === '\r' && tokens[i + 1] && tokens[i + 1].c === '\n') i += 1;
        continue;
      }
      var pinyin = token.pinyin || '';
      if (typeof pinyin !== 'string') {
        throw new TypeError('Token pinyin must be a string');
      }
      paragraphs[paragraphs.length - 1].push({
        source: token,
        pinyin: pinyin,
        pinyinWidth: measure(pinyin)
      });
    }

    // Use positions within a paragraph, never source UTF-16 indices: a
    // supplementary character still occupies exactly one title cell.
    var advance = BASE_ADVANCE;
    paragraphs.forEach(function (paragraph) {
      var previous = null;
      paragraph.forEach(function (item, position) {
        if (!item.pinyin) return;
        if (previous !== null) {
          var required = ((previous.width + item.pinyinWidth) / 2 + PINYIN_GAP) /
            (position - previous.position);
          advance = Math.max(advance, required);
        }
        previous = {position: position, width: item.pinyinWidth};
      });
    });

    function measureLine(items) {
      var left = 0;
      var right = 0;
      items.forEach(function (item, position) {
        var x = position * advance;
        right = Math.max(right, x + FONT_SIZE);
        if (item.pinyin) {
          var pinyinX = x + (FONT_SIZE - item.pinyinWidth) / 2;
          left = Math.min(left, pinyinX);
          right = Math.max(right, pinyinX + item.pinyinWidth);
        }
      });
      var offset = -left;
      return {
        tokens: items.map(function (item, position) {
          var x = position * advance + offset;
          return Object.assign({}, item.source, {
            pinyin: item.pinyin,
            x: round(x),
            width: FONT_SIZE,
            pinyinX: item.pinyin ? round(x + (FONT_SIZE - item.pinyinWidth) / 2) : null,
            pinyinWidth: round(item.pinyinWidth)
          });
        }),
        width: round(right - left),
        height: LINE_HEIGHT
      };
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
        var line = null;
        while (end < paragraph.length) {
          var candidate = measureLine(paragraph.slice(start, end + 1));
          if (candidate.width > availableWidth + EPSILON) break;
          line = candidate;
          end += 1;
        }
        // An oversized unit remains visible to the caller, with its source
        // index intact and an overflow flag instead of silent omission.
        if (line === null) {
          end = start + 1;
          line = measureLine(paragraph.slice(start, end));
        }
        lines.push(line);
        start = end;
      }
    });

    var width = 0;
    lines.forEach(function (line, index) {
      line.y = index * (LINE_HEIGHT + LINE_GAP);
      line.overflow = line.width > availableWidth + EPSILON;
      width = Math.max(width, line.width);
    });
    return {
      lines: lines,
      fontSize: FONT_SIZE,
      pinyinFontSize: PINYIN_SIZE,
      advance: round(advance),
      pinyinMinGap: PINYIN_GAP,
      lineHeight: LINE_HEIGHT,
      lineGap: LINE_GAP,
      width: round(width),
      height: lines.length * LINE_HEIGHT + Math.max(0, lines.length - 1) * LINE_GAP,
      rowCount: lines.length,
      overflow: lines.some(function (line) { return line.overflow; })
    };
  }

  return Object.freeze({layoutTokens: layoutTokens});
});
