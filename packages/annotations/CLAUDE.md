# Annotations Package (`@waveform-playlist/annotations`)

## Integration Context Pattern

**Pattern:** Browser package defines an interface + context, this package provides implementation via a Provider component.

**Flow:** Browser defines `AnnotationIntegrationContext` → this package creates `AnnotationProvider` that supplies components/functions → browser components use `useAnnotationIntegration()` and gracefully return `null` if unavailable.

**Throwing Context Hooks (Kent C. Dodds Pattern):**
`useAnnotationIntegration()` throws if used without the provider. This follows the [Kent C. Dodds context pattern](https://kentcdodds.com/blog/how-to-use-react-context-effectively) — fail fast with a clear error instead of silently rendering nothing.

```typescript
// Components that need annotations — throws if <AnnotationProvider> missing
const integration = useAnnotationIntegration();

// Internal components that render with or without annotations
// use useContext(AnnotationIntegrationContext) directly to get null when absent
const annotationIntegration = useContext(AnnotationIntegrationContext);
```

**Location:** `packages/browser/src/AnnotationIntegrationContext.tsx`

## Annotation Provider Pattern

**Critical:** When using `annotationList` on `WaveformPlaylistProvider`, always pair it with `onAnnotationsChange`. Without the callback, annotation edits won't persist and a console warning fires.

```typescript
<WaveformPlaylistProvider
  annotationList={{ annotations, editable: true, linkEndpoints: false }}
  onAnnotationsChange={setAnnotations}  // Required for edits to persist
>
```

## @dnd-kit Feedback Plugin

Annotation boundary resize handles use `useDraggable({ feedback: 'none' })` to disable the Feedback plugin. Resize visual feedback comes from React state updates repositioning the annotation, not CSS translate.
