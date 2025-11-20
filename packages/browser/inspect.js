// Run this in the browser console on http://localhost:4000/waveform-playlist/flexible-api.html
const volumeInputs = document.querySelectorAll('input[type="range"]');
volumeInputs.forEach((input, i) => {
  const computed = window.getComputedStyle(input);
  const parent = input.parentElement;
  const parentComputed = window.getComputedStyle(parent);
  const grandParent = parent.parentElement;
  const grandParentComputed = window.getComputedStyle(grandParent);

  console.log(`\n=== Volume Slider ${i + 1} ===`);
  console.log('Input:', {
    width: computed.width,
    maxWidth: computed.maxWidth,
    minWidth: computed.minWidth,
    flex: computed.flex,
    boxSizing: computed.boxSizing,
  });
  console.log('Parent (flex container with Vol: label):', {
    width: parentComputed.width,
    padding: parentComputed.padding,
    boxSizing: parentComputed.boxSizing,
    display: parentComputed.display,
    gap: parentComputed.gap,
  });
  console.log('GrandParent (track controls):', {
    width: grandParentComputed.width,
    padding: grandParentComputed.padding,
    boxSizing: grandParentComputed.boxSizing,
  });
  console.log('Label:', input.previousElementSibling?.textContent);
});
