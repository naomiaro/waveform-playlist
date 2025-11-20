import fetch from 'node-fetch';

const CDP_URL = 'http://localhost:9222';

async function inspectVolumeSlider() {
  // Get the page
  const tabs = await fetch(`${CDP_URL}/json/list`).then(r => r.json());
  const flexiblePage = tabs.find(t => t.url.includes('flexible-api.html'));

  if (!flexiblePage) {
    console.error('Flexible API page not found');
    return;
  }

  const wsUrl = flexiblePage.webSocketDebuggerUrl.replace('ws://', 'http://').replace('/devtools/', '/json/');

  // Execute JavaScript to get volume slider info
  const result = await fetch(`${CDP_URL}/json/new?${encodeURIComponent(`javascript:(function(){
    const volumeInputs = document.querySelectorAll('input[type="range"]');
    const results = [];
    volumeInputs.forEach((input, i) => {
      const computed = window.getComputedStyle(input);
      const parent = input.closest('[style*="width"]') || input.parentElement;
      const parentComputed = window.getComputedStyle(parent);
      results.push({
        index: i,
        input: {
          width: computed.width,
          maxWidth: computed.maxWidth,
          minWidth: computed.minWidth,
          flex: computed.flex,
          boxSizing: computed.boxSizing
        },
        parent: {
          width: parentComputed.width,
          padding: parentComputed.padding,
          boxSizing: parentComputed.boxSizing,
          display: parentComputed.display,
          gap: parentComputed.gap
        },
        label: input.previousElementSibling?.textContent
      });
    });
    return JSON.stringify(results, null, 2);
  })()`)}`);

  console.log(await result.text());
}

inspectVolumeSlider().catch(console.error);
