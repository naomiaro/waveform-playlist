// Shared page logic for the two precompiled-Faust demos (native transport and
// Tone adapter). The pages differ only in how they create the adapter.
import { registerFaustTremolo } from './faust-tremolo-effect.js';

const COMPILED = new URL('/faust-compiled/', location.href).href;
const WAM_URL = COMPILED + 'wam/index.js';

export async function setupFaustDemo(editor) {
  const $ = (id) => document.getElementById(id);
  const log = (message) => {
    const line = document.createElement('div');
    line.textContent = message;
    $('log').prepend(line);
  };
  const describe = (err) => (err && err.message ? err.message : String(err));

  // --- targets: the master bus, or one track ---------------------------------
  const targetSelect = $('target');
  const owners = new Map([['master', editor]]);
  const refreshTargets = () => {
    for (const track of editor.querySelectorAll('daw-track')) {
      if (!track.trackId || owners.has(track.trackId)) continue;
      owners.set(track.trackId, track);
      const option = document.createElement('option');
      option.value = track.trackId;
      option.textContent = track.getAttribute('name') || track.trackId;
      targetSelect.appendChild(option);
    }
  };
  editor.addEventListener('daw-track-ready', refreshTargets);
  refreshTargets();
  const owner = () => owners.get(targetSelect.value) || editor;

  // WAM hosting and worklets need a running context; these are click handlers,
  // so resuming here satisfies the browser's user-gesture rule.
  const resume = () => editor.adapter.audioContext.resume();

  // --- route 1: AudioWorklet effect via registerEffect ----------------------
  let registered = null;
  $('add-worklet').addEventListener('click', async () => {
    try {
      await resume();
      registered ??= registerFaustTremolo(COMPILED + 'worklet/');
      await registered;
      await editor.prepareEffect('faust-tremolo'); // registers the processor on the live context
      const id = owner().addEffect('faust-tremolo');
      log('added AudioWorklet tremolo (' + id + ')');
    } catch (err) {
      registered = null;
      log('AudioWorklet route failed: ' + describe(err));
    }
  });

  // --- route 2: the same effect as a static WAM plugin -----------------------
  $('add-wam').addEventListener('click', async () => {
    try {
      await resume();
      const id = await owner().addWamPlugin(WAM_URL);
      log('added WAM tremolo (' + id + ')');
    } catch (err) {
      log('WAM route failed: ' + describe(err));
    }
  });

  // --- rack: one row per effect, with dawcore's own parameter panel ---------
  const rack = $('rack');
  const rows = new Map();
  const ownerOf = (event) => (event.target === editor ? editor : event.target);
  editor.addEventListener('daw-effect-add', async (event) => {
    const { effectId } = event.detail;
    const host = ownerOf(event);
    const info = host.effects.find((effect) => effect.id === effectId);
    const row = document.createElement('div');
    row.className = 'effect';
    const title = document.createElement('strong');
    const where = host === editor ? 'Master' : host.getAttribute('name');
    title.textContent =
      where + ' — ' + (info?.label || info?.type || 'effect') + ' [' + info?.kind + ']';
    const bypass = document.createElement('button');
    bypass.textContent = 'Bypass';
    bypass.addEventListener('click', () => {
      const current = host.effects.find((effect) => effect.id === effectId);
      host.setEffectBypassed(effectId, !current.bypassed);
      bypass.textContent = current.bypassed ? 'Bypass' : 'Enable';
    });
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => host.removeEffect(effectId));
    const panel = document.createElement('div');
    row.append(title, bypass, remove, panel);
    rack.appendChild(row);
    rows.set(effectId, row);
    try {
      // Neither route ships a GUI of its own, so this is dawcore's generic
      // parameter panel: sliders built from the effect's parameter metadata.
      await host.openEffectGui(effectId, panel);
    } catch (err) {
      panel.textContent = 'No parameter panel: ' + describe(err);
    }
  });
  editor.addEventListener('daw-effect-remove', (event) => {
    rows.get(event.detail.effectId)?.remove();
    rows.delete(event.detail.effectId);
  });

  // --- offline export runs the same chains -----------------------------------
  $('export').addEventListener('click', async () => {
    try {
      const buffer = await editor.exportAudio();
      let sum = 0;
      let count = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        for (const sample of buffer.getChannelData(channel)) {
          sum += sample * sample;
          count++;
        }
      }
      log(
        'exported ' +
          buffer.duration.toFixed(2) +
          ' s, ' +
          buffer.numberOfChannels +
          ' ch, RMS ' +
          Math.sqrt(sum / count).toFixed(4)
      );
    } catch (err) {
      log('export failed: ' + describe(err));
    }
  });
}
