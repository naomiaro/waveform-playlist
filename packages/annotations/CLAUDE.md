# Annotations Package (`@waveform-playlist/annotations`)

## Integration Context Pattern

**Pattern:** Browser package defines an interface + context, this package provides implementation via a Provider component.

**Flow:** Browser defines `AnnotationIntegrationContext` → this package creates `AnnotationProvider` that supplies components/functions → browser components read the context. What each does without `<AnnotationProvider>`:

- `WaveformAnnotationBoxes` (through the internal `AnnotationBoxes`, plain `use`): draws nothing, silently. Also nothing when there are no annotations.
- `AnnotationList` (plain `use`): returns `null` first when there are no annotations; with annotations and no provider it returns `null` and writes one development warning (`warnOnce`).
- `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` (`src/components/AnnotationCheckboxes.tsx`) and `DownloadAnnotationsButton`: work. They live in THIS package (#770), are not in the integration, and read browser's `useAnnotationOptions()`, `usePlaybackControls()` and `useAnnotations()`; without a playlist provider those hooks throw. They have no controlled form. The integration (`AnnotationIntegration`) is `parseAeneas`, `serializeAeneas`, `AnnotationText`, `AnnotationBox`, `AnnotationBoxesWrapper`: what browser's own views draw.

**Throwing Context Hooks (Kent C. Dodds Pattern):**
`useAnnotationIntegration()` throws if used without the provider. This follows the [Kent C. Dodds context pattern](https://kentcdodds.com/blog/how-to-use-react-context-effectively) — fail fast with a clear error instead of silently rendering nothing. It is exported for consumers; no component of the library calls it since #770.

```typescript
// A consumer component that cannot work without <AnnotationProvider>: throws when it is missing
const integration = useAnnotationIntegration();

// The parts of a view that must render with or without annotations
// (AnnotationBoxes, AnnotationList) read the context with use() directly and get null when absent
const annotationIntegration = use(AnnotationIntegrationContext);
```

**Location:** `packages/browser/src/AnnotationIntegrationContext.tsx`

## Annotation Provider Pattern

**Critical:** When using `annotationList` on either provider, always pair it with `onAnnotationsChange`. Without the callback, annotation edits won't persist and a development console warning fires. `onAnnotationsChange` is the one report of an annotation change: the components take no `onAnnotationUpdate` (only the package's own `AnnotationText` keeps that prop, which `AnnotationList` feeds with the provider's `setAnnotations`).

The three options (`editable`, `linkEndpoints`, `isContinuousPlay`) are provider state that follows the prop (`useFollowedOption` in `packages/browser/src/providerInternals/useAnnotationState.ts`); the browser reads them with `useAnnotationOptions()` under both providers.

```typescript
<WaveformPlaylistProvider
  annotationList={{ annotations, editable: true }}
  onAnnotationsChange={setAnnotations}  // Required for edits to persist
>
```

## @dnd-kit Feedback Plugin

Annotation boundary resize handles disable the Feedback plugin per-entity: `useDraggable({ plugins: [Feedback.configure({ feedback: 'none' })] })` (`Feedback` from `@dnd-kit/dom`, a declared peer; hoist the array to a module constant for a stable reference). `@dnd-kit` 0.5 removed the old top-level `feedback` hook option — it is silently ignored at runtime, so `annotationBoxFeedbackPlugins.test.tsx` reads the config back from the real registered entity. Resize visual feedback comes from React state updates repositioning the annotation, not CSS translate.
