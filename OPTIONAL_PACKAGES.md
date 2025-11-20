# Optional Packages

Waveform-playlist uses a modular architecture where certain features can be installed as optional packages. This keeps the core library lean while providing advanced functionality for users who need it.

## Why Optional Packages?

**Bundle Size Optimization:** Many users don't need every feature. Optional packages allow you to include only what you use, reducing your application's bundle size.

For example:
- **Without annotations:** ~150KB (core player only)
- **With annotations:** ~200KB (includes annotation UI and logic)

## Available Optional Packages

### @waveform-playlist/annotations

**Purpose:** Complete annotation support for time-synchronized text segments, subtitles, and transcripts.

**Install:**
```bash
npm install @waveform-playlist/annotations
# or
pnpm add @waveform-playlist/annotations
```

**Peer Dependencies:**
- `react` ^18.0.0
- `styled-components` ^6.0.0

**What's Included:**

1. **React Components:**
   - `Annotation` - Individual annotation display with editing controls
   - `AnnotationBox` - Visual time box representation
   - `AnnotationBoxesWrapper` - Container for annotation boxes
   - `AnnotationsTrack` - Track display for annotations
   - `AnnotationText` - Text editing interface
   - `ContinuousPlayCheckbox` - Control for continuous playback
   - `LinkEndpointsCheckbox` - Control for linked annotation boundaries

2. **Custom Hooks:**
   - `useAnnotationControls` - Manages annotation state and boundary logic
     - Continuous play mode
     - Linked endpoints (annotations move together)
     - Collision detection
     - Cascading boundary updates

3. **Types:**
   - `AnnotationType` - Annotation data structure
   - `AnnotationFormat` - Import/export format interface
   - `AnnotationListOptions` - Configuration options
   - `AnnotationEventMap` - Event handlers

4. **Parsers:**
   - Aeneas JSON format support (import/export)

**Usage Example:**

```typescript
import { WaveformPlaylistComponent } from '@waveform-playlist/browser';
import {
  useAnnotationControls,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  AnnotationsTrack,
  AnnotationBox,
  AnnotationText,
} from '@waveform-playlist/annotations';

function AnnotatedPlayer() {
  const annotations = [
    { id: '1', start: 0, end: 2.5, lines: ['Hello world'] },
    { id: '2', start: 2.5, end: 5.0, lines: ['Second segment'] },
  ];

  return (
    <WaveformPlaylistComponent
      tracks={[{ src: 'audio.mp3' }]}
      annotationList={{
        annotations,
        editable: true,
        isContinuousPlay: false,
        linkEndpoints: true,
      }}
    />
  );
}
```

**With Hook:**

```typescript
import { useAnnotationControls } from '@waveform-playlist/annotations';

function MyAnnotationControls() {
  const {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
    updateAnnotationBoundaries,
  } = useAnnotationControls({
    initialContinuousPlay: false,
    initialLinkEndpoints: true,
  });

  return (
    <div>
      <ContinuousPlayCheckbox
        checked={continuousPlay}
        onChange={setContinuousPlay}
      />
      <LinkEndpointsCheckbox
        checked={linkEndpoints}
        onChange={setLinkEndpoints}
      />
    </div>
  );
}
```

**Features:**

- **Drag-to-adjust:** Drag annotation boundaries to adjust timing
- **Linked endpoints:** Adjacent annotations move together when boundaries touch
- **Collision detection:** Prevents annotations from overlapping
- **Continuous play:** Optional automatic progression through annotations
- **Editable text:** Live editing of annotation content
- **Custom actions:** Add custom buttons/actions to each annotation
- **Import/Export:** Aeneas JSON format support

**Use Cases:**
- Subtitle/caption editing
- Transcript synchronization
- Audio annotation/labeling
- Speech segmentation
- TED talk transcription

## How to Add New Optional Packages

If you're developing a new optional feature for waveform-playlist:

### 1. Create a New Package

```bash
mkdir packages/my-feature
cd packages/my-feature
npm init -y
```

### 2. Configure package.json

```json
{
  "name": "@waveform-playlist/my-feature",
  "version": "5.0.0-alpha.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "dependencies": {
    "@waveform-playlist/core": "workspace:*"
  }
}
```

### 3. Add to Workspace

Ensure `pnpm-workspace.yaml` includes your package:
```yaml
packages:
  - 'packages/*'
```

### 4. Structure Your Package

```
packages/my-feature/
├── src/
│   ├── components/      # React components
│   ├── hooks/           # Custom hooks
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities
│   └── index.ts         # Public exports
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### 5. Document Your Package

- Add usage examples
- Document all exported APIs
- Include peer dependencies
- Explain when users should install it

### 6. Update This File

Add your package to the "Available Optional Packages" section above.

## Best Practices

1. **Keep It Optional:** Only features that a minority of users need should be optional packages
2. **Clear Boundaries:** Each package should have a focused purpose
3. **Peer Dependencies:** Minimize peer dependencies to reduce installation complexity
4. **Tree-Shakeable:** Export individual functions/components, not just a default
5. **Well-Typed:** Provide complete TypeScript definitions
6. **Documented:** Include usage examples and API documentation

## Installation Tips

### Check Bundle Size Impact

Before deciding to install an optional package, you can check its size:

```bash
npm install @waveform-playlist/annotations --dry-run
```

### Lazy Loading

For single-page applications, consider lazy loading optional packages:

```typescript
const AnnotationsUI = React.lazy(() =>
  import('@waveform-playlist/annotations').then(mod => ({
    default: mod.AnnotationsTrack
  }))
);
```

### Tree Shaking

When using modern bundlers (Webpack 5+, Vite, Rollup), unused exports are automatically removed:

```typescript
// Only AnnotationBox is included in your bundle
import { AnnotationBox } from '@waveform-playlist/annotations';
```

## Support

If you have questions about optional packages:
- Check the package README: `packages/<package-name>/README.md`
- See the examples: `ghpages/_examples/`
- Review the documentation: `packages/<package-name>/docs/`
- Ask in GitHub Discussions: https://github.com/naomiaro/waveform-playlist/discussions

---

**Last Updated:** 2025-01-19
