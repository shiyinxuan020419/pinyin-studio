(function () {
  'use strict';

  const ARTICLE_TOP = 248;
  const ARTICLE_HEIGHT = 663;
  const DETAIL_PADDING = 32;

  function makeProfile(id, label, width, articleWidth, artworkScale = 1) {
    const directoryWidth = 502 * artworkScale;
    const illustrationWidth = 433 * artworkScale;
    const contentWidth = directoryWidth + 24 + articleWidth + 24 + illustrationWidth;
    const contentLeft = (width - contentWidth) / 2;
    const articleLeft = contentLeft + directoryWidth + 24;
    const illustrationLeft = articleLeft + articleWidth + 24;
    return Object.freeze({
      id,
      label,
      width,
      height: 1080,
      contentLeft,
      contentWidth,
      artworkScale,
      directoryLeft: contentLeft,
      illustrationLeft,
      illustrationTop: 589 - 120 * artworkScale,
      articlePanel: Object.freeze({
        x: articleLeft,
        y: ARTICLE_TOP,
        width: articleWidth,
        height: ARTICLE_HEIGHT
      })
    });
  }

  // These dimensions are logical design coordinates, independent of the
  // browser's available preview area or any physical device's pixel density.
  const original = Object.freeze({
    id: 'original',
    label: '原稿',
    width: 1756,
    height: 1080,
    contentLeft: 166,
    contentWidth: 1423,
    artworkScale: 1,
    directoryLeft: 166,
    illustrationLeft: 1156,
    illustrationTop: 469,
    articlePanel: Object.freeze({
      x: 680,
      y: ARTICLE_TOP,
      width: 487,
      height: ARTICLE_HEIGHT
    })
  });

  const profiles = Object.freeze([
    original,
    makeProfile('wide', '16:9', 1920, 600),
    makeProfile('ultrawide', '21:9', 2520, 720),
    makeProfile('tablet', '4:3', 1440, 487, 0.8)
  ]);

  function getProfile(id) {
    return profiles.find(profile => profile.id === id) || original;
  }

  function applyProfile(stage, id) {
    const profile = getProfile(id);
    stage.dataset.profile = profile.id;
    stage.style.width = `${profile.width}px`;
    stage.style.height = `${profile.height}px`;
    const values = {
      '--device-width': `${profile.width}px`,
      '--device-height': `${profile.height}px`,
      '--content-left': `${profile.contentLeft}px`,
      '--content-width': `${profile.contentWidth}px`,
      '--directory-left': `${profile.directoryLeft}px`,
      '--artwork-scale': profile.artworkScale,
      '--article-left': `${profile.articlePanel.x}px`,
      '--article-top': `${profile.articlePanel.y}px`,
      '--article-width': `${profile.articlePanel.width}px`,
      '--article-height': `${profile.articlePanel.height}px`,
      '--illustration-left': `${profile.illustrationLeft}px`,
      '--illustration-top': `${profile.illustrationTop}px`,
      '--shadow-left': `${profile.illustrationLeft - 7.7 * profile.artworkScale}px`,
      '--shadow-top': `${profile.illustrationTop + 95.796 * profile.artworkScale}px`
    };
    for (const [property, value] of Object.entries(values)) {
      stage.style.setProperty(property, String(value));
    }
    return profile;
  }

  function frameFor(stage, id, mode = 'full') {
    const profile = getProfile(id || stage?.dataset.profile);
    if (mode !== 'text') {
      return { x: 0, y: 0, width: profile.width, height: profile.height };
    }
    const article = profile.articlePanel;
    return {
      x: article.x - DETAIL_PADDING,
      y: article.y - DETAIL_PADDING,
      width: article.width + DETAIL_PADDING * 2,
      height: article.height + DETAIL_PADDING * 2
    };
  }

  globalThis.LessonViewport = Object.freeze({
    profiles,
    getProfile,
    applyProfile,
    frameFor
  });
})();
