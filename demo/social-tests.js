// Instagram-style fixture for independent Stories, post-feed, and suggestion controls.
(async () => {
  const { assert, send, wait, policy } = window.lab;
  const getElement = (elementId) => document.getElementById(elementId);
  const isSurfaceHidden = (elementId) =>
    getElement(elementId).hasAttribute('data-qb-social-hidden');
  const isRendered = (elementId) => {
    let element = getElement(elementId);
    while (element) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      element = element.parentElement;
    }
    return true;
  };

  async function applyIndependentSurfaces({ stories, suggestions, home }) {
    policy.settings.socialStories = stories;
    policy.settings.socialSuggestions = suggestions;
    policy.settings.socialHomeFeed = home;
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      isSurfaceHidden('stories') === stories &&
        isSurfaceHidden('stories-nav') === stories &&
        isRendered('stories') === !stories,
      `Stories ${stories ? 'hide' : 'remain visible'} independently`,
    );
    assert(
      isSurfaceHidden('suggestions') === suggestions && isRendered('suggestions') === !suggestions,
      `Follow recommendations ${suggestions ? 'hide' : 'remain visible'} independently`,
    );
    assert(
      isSurfaceHidden('post-carousel') === home &&
        isSurfaceHidden('second-post') === home &&
        isSurfaceHidden('unwrapped-post') === home &&
        isRendered('post-carousel') === !home,
      `Followed-post feed regions ${home ? 'hide' : 'remain visible'} independently`,
    );
    assert(
      !isSurfaceHidden('story-article-decoy') &&
        !isSurfaceHidden('suggestion-article-decoy') &&
        isRendered('story-article-decoy') === !stories &&
        isRendered('suggestion-article-decoy') === !suggestions,
      'Home-feed hiding never takes ownership of nested Story or suggestion articles',
    );
    assert(
      !isSurfaceHidden('home') && !document.querySelector('main[data-qb-social-hidden]'),
      'The shared Instagram main structure is never hidden',
    );
  }

  try {
    window.fixturePath = '/';
    policy.settings = {
      ...policy.settings,
      socialStories: false,
      socialSuggestions: false,
      socialShortVideo: true,
      socialExplore: true,
      socialHomeFeed: false,
    };
    await send({ type: 'QB_REFRESH' });
    await wait();
    let status = await send({ type: 'QB_STATUS' });
    assert(
      status.platform === 'instagram' && status.route === 'home',
      'Instagram home route is classified locally',
    );

    // Exercise every combination because these regions are siblings in some layouts
    // and nested under the same <main> element in others.
    for (let combination = 0; combination < 8; combination += 1) {
      await applyIndependentSurfaces({
        stories: Boolean(combination & 1),
        suggestions: Boolean(combination & 2),
        home: Boolean(combination & 4),
      });
    }
    assert(
      !isSurfaceHidden('messages-nav') && !isSurfaceHidden('profile-nav'),
      'Messages and profiles stay available in every home-page combination',
    );
    assert(isSurfaceHidden('reels-nav'), 'Reels entry point remains independently hidden');
    assert(isSurfaceHidden('explore-nav'), 'Explore entry point remains independently hidden');

    const insertedPost = document.createElement('article');
    insertedPost.id = 'inserted-post';
    const insertedPostLink = document.createElement('a');
    insertedPostLink.href = '/p/inserted-post/';
    insertedPostLink.append(Object.assign(document.createElement('img'), { alt: 'New post' }));
    insertedPost.append(insertedPostLink);
    getElement('home').append(insertedPost);
    await wait();
    assert(
      isSurfaceHidden('inserted-post') &&
        !isRendered('inserted-post') &&
        !document.querySelector('main[data-qb-social-hidden]'),
      'A newly loaded post is hidden without swallowing Stories or recommendations',
    );

    policy.settings.socialHomeFeed = false;
    await send({ type: 'QB_REFRESH' });
    const visibleDynamicPost = document.createElement('article');
    visibleDynamicPost.id = 'visible-dynamic-post';
    const visibleDynamicLink = document.createElement('a');
    visibleDynamicLink.href = '/p/visible-dynamic-post/';
    visibleDynamicLink.append(
      Object.assign(document.createElement('img'), { alt: 'Visible post' }),
    );
    visibleDynamicPost.append(visibleDynamicLink);
    getElement('home').append(visibleDynamicPost);
    await wait();
    assert(
      !isSurfaceHidden('visible-dynamic-post') && isRendered('visible-dynamic-post'),
      'A post inserted while Hide home feed is off remains rendered and unmarked',
    );

    const today = new Date().getDay();
    policy.settings.socialHomeFeed = false;
    policy.settings.socialStories = true;
    policy.settings.socialSuggestions = true;
    policy.settings.socialSchedules = {
      ...policy.settings.socialSchedules,
      socialStories: {
        scheduled: true,
        windows: [{ days: [(today + 1) % 7], start: '00:00', end: '00:00' }],
      },
    };
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('stories') &&
        isSurfaceHidden('suggestions') &&
        !isSurfaceHidden('post-carousel'),
      'A Stories schedule can restore only Stories outside its selected local-time window',
    );
    policy.settings.socialSchedules.socialStories.windows[0].days = [today];
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      isSurfaceHidden('stories') &&
        isSurfaceHidden('suggestions') &&
        !isSurfaceHidden('post-carousel'),
      'The Stories schedule activates without changing the other two surfaces',
    );

    window.fixturePath = '/stories/quiet-user/123/';
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('stories') && isSurfaceHidden('stories-nav'),
      'A directly opened Story stays viewable while its entry point remains hidden',
    );

    const reelsRouteContent = document.createElement('section');
    reelsRouteContent.id = 'reels-route-content';
    reelsRouteContent.append(document.createElement('video'));
    const reelsToolbar = document.createElement('aside');
    reelsToolbar.id = 'reels-route-toolbar';
    reelsToolbar.setAttribute('aria-label', 'Reels navigation controls');
    document.querySelector('main').append(reelsRouteContent, reelsToolbar);
    window.fixturePath = '/reels/';
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      isSurfaceHidden('reels-route-content') &&
        !isRendered('reels-route-content') &&
        !isSurfaceHidden('reels-route-toolbar') &&
        !document.querySelector('main[data-qb-social-hidden]'),
      'The Reels body hides without swallowing its navigation or shared main container',
    );
    reelsRouteContent.remove();
    reelsToolbar.remove();

    const exploreRouteContent = document.createElement('section');
    exploreRouteContent.id = 'explore-route-content';
    for (let index = 0; index < 3; index += 1) {
      const link = document.createElement('a');
      link.href = `/p/explore-${index}/`;
      link.append(Object.assign(document.createElement('img'), { alt: `Explore ${index}` }));
      exploreRouteContent.append(link);
    }
    document.querySelector('main').append(exploreRouteContent);
    window.fixturePath = '/explore/';
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      isSurfaceHidden('explore-route-content') &&
        !isRendered('explore-route-content') &&
        !document.querySelector('main[data-qb-social-hidden]'),
      'The Explore grid hides as a bounded child without hiding shared page structure',
    );
    exploreRouteContent.remove();

    window.fixturePath = '/direct/t/123/';
    await send({ type: 'QB_REFRESH' });
    await wait();
    status = await send({ type: 'QB_STATUS' });
    assert(
      status.route === 'messages' && !isSurfaceHidden('direct-item'),
      'Message route and opened content remain viewable',
    );
    assert(
      isSurfaceHidden('recommendations'),
      'The non-scrollable received item remains while its continuation feed is removed',
    );
    assert(
      !isSurfaceHidden('post-carousel') && !document.querySelector('[data-qb-social-notice]'),
      'A message route is not mistaken for the home feed',
    );

    window.fixturePath = '/reel/abc123/';
    const liveLikeContinuation = document.createElement('section');
    liveLikeContinuation.id = 'live-like-continuation';
    const continuationLabel = document.createElement('span');
    continuationLabel.textContent = 'More posts from quiet-user';
    liveLikeContinuation.append(continuationLabel);
    for (let index = 0; index < 2; index += 1) {
      const link = document.createElement('a');
      link.href = `/p/continuation-${index}/`;
      link.textContent = `Continuation ${index}`;
      liveLikeContinuation.append(link);
    }
    document.querySelector('main').append(liveLikeContinuation);
    await send({ type: 'QB_REFRESH' });
    await wait();
    assert(
      !isSurfaceHidden('direct-item') &&
        isSurfaceHidden('recommendations') &&
        isSurfaceHidden('live-like-continuation') &&
        !isRendered('live-like-continuation'),
      'A direct Reel URL stays viewable without its labeled continuation feed',
    );

    policy.enabled = false;
    await send({ type: 'QB_REFRESH' });
    const disabledDynamicPost = document.createElement('article');
    disabledDynamicPost.id = 'disabled-dynamic-post';
    const disabledDynamicLink = document.createElement('a');
    disabledDynamicLink.href = '/p/disabled-dynamic-post/';
    disabledDynamicLink.append(
      Object.assign(document.createElement('img'), { alt: 'Disabled post' }),
    );
    disabledDynamicPost.append(disabledDynamicLink);
    getElement('home').append(disabledDynamicPost);
    await wait();
    assert(
      !document.querySelector('[data-qb-social-hidden],[data-qb-social-notice]') &&
        isRendered('disabled-dynamic-post'),
      'Turning Quiet Browse off restores every surface and leaves new posts untouched',
    );
    getElement('test-status').textContent =
      `PASS — ${document.querySelectorAll('#results .pass').length} independent Instagram surface checks. This fixture is not a live-platform compatibility claim.`;
  } catch (error) {
    getElement('test-status').textContent = `FAIL — ${error.message}`;
    console.error(error);
  }
})();
