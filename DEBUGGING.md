# Debugging Guide for Waveform Playlist

This guide documents common debugging issues and solutions for the waveform-playlist project.

## AudioWorklet Issues

### Problem: Worklet Changes Not Appearing

**Symptoms:**
- You modify worklet code but changes don't take effect
- Old worklet behavior persists even after rebuilding
- No console.log messages from worklet (even though you added them)

**Root Causes:**

1. **Jekyll Server Caching**
   - The Jekyll development server aggressively caches static files
   - Worklet files in `ghpages/js/worklet/` may be served from cache
   - This happens even with browser hard refresh!

2. **Build Process Copying Worklets**
   - Worklets are built to `packages/recording/dist/`
   - They are automatically copied to `ghpages/js/worklet/` by the build script
   - The `build-all.sh` script handles this after building the recording bundle

3. **Browser AudioContext Caching**
   - Once an AudioWorklet module is registered, it persists in the AudioContext
   - Creating a new AudioContext doesn't always reload the worklet
   - Cache-busting query parameters may not work

### Step-by-Step Debugging

#### 1. Verify the Source File Has Your Changes

```bash
# Check the TypeScript source has your changes
grep -n "YOUR_CODE_PATTERN" packages/recording/src/worklet/recording-processor.worklet.ts
```

#### 2. Verify the Built File Has Your Changes

```bash
# Check the built file has your changes
grep -n "YOUR_CODE_PATTERN" packages/recording/dist/recording-processor.worklet.js

# Check file size and timestamp
ls -lh packages/recording/dist/recording-processor.worklet.js
```

#### 3. Verify the Deployed File Has Your Changes

```bash
# Check the deployed file in ghpages
grep -n "YOUR_CODE_PATTERN" ghpages/js/worklet/recording-processor.worklet.js

# Compare file sizes (should match dist file)
ls -lh packages/recording/dist/recording-processor.worklet.js
ls -lh ghpages/js/worklet/recording-processor.worklet.js
```

#### 4. Verify Worklet Was Copied

The build script automatically copies the worklet, but you can verify:

```bash
# Check that the worklet was copied
ls -lh ghpages/js/worklet/recording-processor.worklet.js

# If needed, manually copy
# (normally not required - build script does this automatically)
# cp packages/recording/dist/recording-processor.worklet.js ghpages/js/worklet/
```

#### 5. Restart Jekyll Server

**CRITICAL:** Jekyll caches static files. You MUST restart the server:

```bash
# Find and kill Jekyll processes
ps aux | grep jekyll | grep -v grep
kill <PID>  # Use the PID from the previous command

# Restart Jekyll
cd ghpages
jekyll serve --livereload
```

#### 6. Verify Server is Serving New File

In the browser console or via DevTools:

```javascript
// Fetch the worklet and check content
const response = await fetch(
  'http://127.0.0.1:4000/waveform-playlist/js/worklet/recording-processor.worklet.js',
  { cache: 'reload' }
);
const text = await response.text();

console.log({
  hasYourCode: text.includes('YOUR_CODE_PATTERN'),
  contentLength: text.length,
  preview: text.substring(0, 200)
});
```

#### 7. Hard Refresh Browser

```
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows/Linux)
```

### Important Note: AudioWorklet Console Logging

**AudioWorklet `console.log()` messages DO NOT appear in the regular browser console!**

Despite what some documentation suggests, console messages from AudioWorklet processors run in a separate thread and are not visible in the main DevTools console.

**Debugging alternatives:**
1. Send debug data via `postMessage()` to the main thread
2. Use the worklet to update React state and display values in the UI
3. Check the document title (as we do in recording-app.tsx)
4. Use the live waveform visualization to verify audio is flowing

## Common Issues and Solutions

### Issue: VU Meter Flat During Recording

**Symptoms:**
- Recording appears to work (button changes, timer running)
- Live waveform may show audio OR be flat
- VU meter shows no activity (width: 0px)
- Document title shows "RMS: 0"

**Debugging steps:**

1. **Check if worklet is sending messages:**
   ```javascript
   // Add this to useRecording.ts onmessage handler
   console.log('[useRecording] Received RMS:', rmsLevel, 'Samples:', samples.length);
   ```
   If you see these logs, worklet IS sending messages.

2. **Check the message structure:**
   ```javascript
   // Log the full message
   workletNode.port.onmessage = (event) => {
     console.log('[useRecording] Full message:', event.data);
   };
   ```

3. **Verify RMS value in message:**
   The worklet sends:
   ```typescript
   {
     samples: Float32Array,
     rmsLevel: number  // Should be 0-1 range
   }
   ```

4. **Check VU meter rendering:**
   Inspect the VU meter fill element:
   ```javascript
   const fill = document.querySelector('[style*="width"]');
   console.log('VU meter width:', fill?.style.width);
   ```

### Issue: No Audio from Microphone

**Symptoms:**
- Monitoring shows RMS values
- Recording shows RMS: 0
- Live waveform flat

**Possible causes:**
1. Recording using wrong AudioContext
2. MediaStreamSource not connected properly
3. WorkletNode not connected to source
4. AudioContext suspended

**Check AudioContext state:**
```javascript
// In browser console
const context = Tone.getContext().rawContext;
console.log('AudioContext state:', context.state);
console.log('Sample rate:', context.sampleRate);
```

## Build Commands Reference

```bash
# Build everything (includes automatic worklet copy)
pnpm build

# Build and serve locally
pnpm build
cd ghpages
jekyll serve --livereload
```

## Network Debugging

### Check if Worklet is Requested

In Chrome DevTools > Network tab:
- Filter by "worklet" or "recording-processor"
- Look for requests to `/js/worklet/recording-processor.worklet.js`
- **If no request appears:** Worklet is being cached or loading is failing silently

### Expected Worklet URL

```
http://127.0.0.1:4000/waveform-playlist/js/worklet/recording-processor.worklet.js
```

The worklet is loaded via `new URL('./worklet/recording-processor.worklet.js', import.meta.url)` which resolves relative to the bundle location.

## File Locations Reference

```
Source TypeScript:
  packages/recording/src/worklet/recording-processor.worklet.ts

Built JavaScript:
  packages/recording/dist/recording-processor.worklet.js
  packages/recording/dist/recording-processor.worklet.mjs

Deployed for Jekyll:
  ghpages/js/worklet/recording-processor.worklet.js

Main bundle:
  ghpages/js/recording-bundle.js
```

## Quick Checklist

When debugging recording/worklet issues:

- [ ] Modified source file (`.ts`)
- [ ] Ran `pnpm build` (automatically copies worklet)
- [ ] Verified built file has changes (`dist/`)
- [ ] Verified worklet was copied to `ghpages/js/worklet/`
- [ ] Restarted Jekyll server
- [ ] Hard refreshed browser (Cmd+Shift+R)
- [ ] Verified server is serving new file (fetch in console)
- [ ] Checked for worklet request in Network tab

## Understanding the Architecture

### Two Separate Level Monitoring Systems

1. **Pre-recording Monitoring** (`useMicrophoneLevel`)
   - Uses AnalyserNode
   - Shows level before/without recording
   - Console logs appear as `[useMicrophoneLevel]`

2. **During Recording** (`useRecording`)
   - Uses AudioWorklet
   - Calculates RMS in worklet thread
   - Console logs appear as `[useRecording]`
   - **Worklet logs DO NOT appear in console!**

### CRITICAL: Shared MediaStreamSource Connection Issue

**Problem:** Both `useMicrophoneLevel` and `useRecording` connect to the same shared `MediaStreamAudioSourceNode`. When the AudioContext transitions from 'suspended' to 'running' (e.g., when recording starts), `useMicrophoneLevel` was doing:

```typescript
// BAD - Disconnects ALL consumers!
sourceRef.current.disconnect();
sourceRef.current.connect(analyserRef.current);
```

Calling `disconnect()` without arguments **disconnects ALL connections** from the source node, including the worklet connection used by `useRecording`.

**Solution:** Use targeted disconnect:

```typescript
// GOOD - Only disconnects the specific connection
sourceRef.current.disconnect(analyserRef.current);
sourceRef.current.connect(analyserRef.current);
```

**Symptom:** VU meter flat during recording, live waveform flat, error when stopping: "Failed to execute 'disconnect' on 'AudioNode': the given destination is not connected."

**Fixed in:** `packages/recording/src/hooks/useMicrophoneLevel.ts` (line 137)

### AudioContext Architecture

- **Global AudioContext:** Shared across app (Tone.js, monitoring, playback)
- **Recording uses global context:** Via `getGlobalAudioContext()`
- **MediaStreamSource:** Managed and shared across consumers
- **Worklet:** Loaded once per AudioContext, persists until context is closed

## Last Resort: Clear Everything

If all else fails:

```bash
# Kill Jekyll
pkill -f jekyll

# Rebuild everything
pnpm build

# Copy worklet manually
cp packages/recording/dist/recording-processor.worklet.js ghpages/js/worklet/

# Restart Jekyll
cd ghpages
jekyll serve --livereload

# In browser:
# 1. Close ALL tabs with the app
# 2. Clear cache (Cmd+Shift+Delete)
# 3. Reopen in new tab
```

## Additional Resources

- [AudioWorklet MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [Chrome DevTools for Audio](https://developer.chrome.com/blog/audio-worklet/)
- Jekyll documentation on asset caching
