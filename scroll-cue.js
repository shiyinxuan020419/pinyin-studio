(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LessonScrollCue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EPSILON = 0.000001;

  function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  /**
   * Return the inner scroller height in unscaled design coordinates.
   * Keep the outer slot at availableHeight when choosing the lesson font size.
   *
   * Invalid heights become zero; invalid layout metrics leave a valid height
   * unchanged. The layout object and its font/spacing values are never changed.
   */
  function viewportHeight(layout, availableHeight) {
    if (!finiteNumber(availableHeight) || availableHeight < 0) return 0;
    if (!layout || layout.overflow !== true || availableHeight === 0) {
      return availableHeight;
    }

    var fontSize = layout.fontSize;
    var pinyinFontSize = layout.pinyinFontSize;
    var pinyinGap = layout.pinyinGap;
    var lineHeight = layout.lineHeight;
    var lineGap = layout.lineGap;
    var rowCount = layout.rowCount;
    var metrics = [fontSize, pinyinFontSize, pinyinGap, lineHeight, lineGap];
    if (!metrics.every(finiteNumber) || fontSize <= 0 || lineHeight <= 0 ||
        pinyinFontSize < 0 || pinyinGap < 0 || lineGap < 0 ||
        !Number.isSafeInteger(rowCount) || rowCount < 1) {
      return availableHeight;
    }

    var glyphTop = pinyinFontSize + pinyinGap;
    var stride = lineHeight + lineGap;
    var contentHeight = rowCount * lineHeight + (rowCount - 1) * lineGap;
    if (!finiteNumber(stride) || !finiteNumber(contentHeight) ||
        glyphTop + fontSize > lineHeight + EPSILON) {
      return availableHeight;
    }
    // A width-only overflow must not create an artificial vertical scroll cue.
    if (contentHeight <= availableHeight + EPSILON) return availableHeight;

    var halfGlyph = glyphTop + fontSize / 2;
    if (availableHeight < halfGlyph) return availableHeight;

    var currentRow = Math.floor(availableHeight / stride);
    var positionInRow = availableHeight - currentRow * stride;
    var visibleGlyphFraction = (positionInRow - glyphTop) / fontSize;
    // Natural partial characters already provide the cue without losing a row.
    if (visibleGlyphFraction >= 0.25 - EPSILON &&
        visibleGlyphFraction <= 0.75 + EPSILON) {
      return availableHeight;
    }

    var fullStrides = Math.floor((availableHeight - halfGlyph) / stride);
    fullStrides = Math.min(fullStrides, rowCount - 1);
    var candidate = fullStrides * stride + halfGlyph;
    return Math.min(availableHeight, Math.round(candidate * 10000) / 10000);
  }

  return Object.freeze({viewportHeight: viewportHeight});
});
