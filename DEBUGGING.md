# Debugging Guide for Waveform Playlist

This guide documents common debugging issues and solutions for the waveform-playlist project.

## Development Environment

### Starting the Dev Server

```bash
cd website
pnpm start
```

The Docusaurus dev server runs at `http://localhost:3000/waveform-playlist/` with hot module replacement.

### Hard Refresh

After making changes, always hard refresh:
```
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows/Linux)
```

### TypeScript Errors

Build scripts enforce TypeScript checking. Run manually:

```bash
pnpm typecheck
```

## AudioWorklet Debugging

### Problem: console.log() Doesn't Work in Worklets

**AudioWorklet `console.log()` messages DO NOT appear in the browser console!**

Worklet processors run in a separate audio thread. Console messages are not visible in DevTools.

**Solutions:**

1. **Send debug data via postMessage():**
```typescript
// In worklet
this.port.postMessage({ type: 'debug', data: yourDebugData });

// In main thread
workletNode.port.onmessage = (event) => {
  if (event.data.type === 'debug') {
    console.log('Worklet debug:', event.data.data);
  }
};
```

2. **Update React state to display values in UI**

3. **Use live waveform visualization to verify audio flow**

### Problem: Worklet Changes Not Appearing

**Symptoms:**
- Modified worklet code but changes don't take effect
- Old behavior persists after rebuilding

**Solutions:**

1. **Rebuild the recording package:**
```bash
cd packages/recording
pnpm build
```

2. **Hard refresh browser** (Cmd+Shift+R)

3. **Clear browser cache completely** if issues persist

4. **Verify built file has changes:**
```bash
grep -n "YOUR_CODE" packages/recording/dist/recording-processor.worklet.js
```

## Audio Architecture

### Global AudioContext

The app uses a shared global AudioContext (same as Tone.js):

```typescript
import { getGlobalAudioContext, resumeGlobalAudioContext } from '@waveform-playlist/playout';

// Resume on user interaction
await resumeGlobalAudioContext();
```

**Critical:** Context must be resumed via user interaction before audio will play.

### Shared MediaStreamSource Pattern

Both `useRecording` and `useMicrophoneLevel` share the same MediaStreamSource. Use **targeted disconnect**:

```typescript
// CORRECT - Only disconnects specific connection
source.disconnect(analyser);
source.connect(analyser);

// WRONG - Breaks ALL connections including other consumers
source.disconnect();  // Don't do this!
source.connect(analyser);
```

### Tone.js Initialization

**Critical:** Call `await Tone.start()` after user interaction and before `Tone.now()`.

Without `Tone.start()`, `Tone.now()` returns null causing RangeError in scheduling.

## styled-components Debugging

### Problem: Dynamic Styles Not Applied

styled-components does NOT support dynamic property names:

```typescript
// BROKEN - Dynamic property name doesn't work
border-${props => props.$edge}: 2px solid red;

// CORRECT - Use conditionals
${props => props.$edge === 'left'
  ? 'border-left: 2px solid red;'
  : 'border-right: 2px solid red;'
}
```

### Problem: Styles Stale After Changes

The Docusaurus dev server hot-reloads styled-components. If styles seem stale:

1. Hard refresh (Cmd+Shift+R)
2. Check browser DevTools > Elements > Computed styles
3. Restart dev server if needed

## Common Issues

### Issue: No Audio from Microphone

**Check AudioContext state:**
```javascript
// In browser console
const context = Tone.getContext().rawContext;
console.log('State:', context.state);  // Should be 'running'
console.log('Sample rate:', context.sampleRate);
```

**Possible causes:**
1. AudioContext suspended (needs user interaction)
2. MediaStreamSource not connected
3. Microphone permissions denied

### Issue: Playback Not Starting

**Symptoms:**
- Click play but nothing happens
- No audio output

**Check:**
1. `Tone.start()` called after user interaction
2. AudioContext state is 'running'
3. Tracks have valid audio buffers loaded

### Issue: Drag/Drop Not Working

**Check:**
1. `interactiveClips` prop is set on `<Waveform>`
2. @dnd-kit context is properly set up
3. Drag handle props are passed to ClipBoundary/ClipHeader

**Debug in DevTools:**
```javascript
// Check for drag elements
document.querySelectorAll('[data-boundary-edge]').length  // Should be > 0
document.querySelectorAll('[data-clip-header]').length    // Should be > 0
```

### Issue: Canvas Not Rendering

**Check:**
1. Container has non-zero dimensions
2. Waveform data is loaded (check network tab)
3. No JavaScript errors in console

## Network Debugging

### Check Audio File Loading

In DevTools > Network tab:
- Filter by media/audio
- Verify audio files return 200 status
- Check Content-Type headers

### Check Worklet Loading

Filter by "worklet" in Network tab:
- Look for `recording-processor.worklet.js`
- Verify 200 status and correct content

## Build Debugging

### TypeScript Build Failures

```bash
# Check types across all packages
pnpm typecheck

# Build specific package
cd packages/ui-components
pnpm build
```

### Storybook Issues

```bash
cd packages/ui-components
pnpm storybook
```

Check console for:
- Missing dependencies
- Invalid story syntax
- Import errors

## Browser DevTools Tips

### Audio Tab (Chrome)

Chrome DevTools has a hidden audio debugging panel:
1. Open DevTools
2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P
3. Type "Show WebAudio"
4. View AudioContext graph and connections

### Performance Profiling

For smooth 60fps animations (playhead, VU meters):

1. Open DevTools > Performance
2. Record while playing audio
3. Check for long tasks or dropped frames
4. Verify requestAnimationFrame callbacks < 16ms

## File Locations Reference

```
Source packages:
  packages/core/           - Core types and utilities
  packages/playout/        - Audio playback engine (Tone.js)
  packages/recording/      - AudioWorklet recording
  packages/ui-components/  - React components
  packages/browser/        - Main browser bundle

Worklet files:
  packages/recording/src/worklet/recording-processor.worklet.ts  (source)
  packages/recording/dist/recording-processor.worklet.js         (built)

Website:
  website/src/pages/examples/     - Example page routes
  website/src/components/examples/ - Example React components
```

## Quick Checklist

When debugging issues:

- [ ] Hard refreshed browser (Cmd+Shift+R)
- [ ] Checked browser console for errors
- [ ] Verified AudioContext state is 'running'
- [ ] Ran `pnpm typecheck` to check for type errors
- [ ] Checked Network tab for failed requests
- [ ] Inspected elements in DevTools to verify DOM structure
- [ ] Checked computed styles for styling issues

## Additional Resources

- [AudioWorklet MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [Tone.js Documentation](https://tonejs.github.io/)
- [@dnd-kit Documentation](https://docs.dndkit.com/)
- [styled-components Documentation](https://styled-components.com/docs)
