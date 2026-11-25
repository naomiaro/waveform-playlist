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

**The annotation store is the one owner (#867).** The app makes an `AnnotationStore` (core's `createAnnotationStore`, browser's `useCreateAnnotationStore`) and passes it as either provider's `annotationStore`; `annotationList` holds only the three options. Every write is `store.set` / `store.update` on the store's current list; nothing in the library keeps a copy it writes back. Without the prop there are no annotations and the writers do nothing.

`AnnotationText` takes `store?: AnnotationStore` (no callback): text, id and control edits call `store.update` and find their row by id in `current`, not by the drawn index. `annotations` stays what it draws (under the provider, `AnnotationList` passes the list with a drag in progress applied, which differs from the store during a drag). Without `store` it is read-only: no editable field, no controls. The id field refuses an empty id and a duplicate (nothing written, the stored id shown again); a text blur with unchanged text returns `current`, so no subscriber is told; a field whose edit was not stored is reset to the stored text. A control's `action` runs through `utils/runAnnotationAction.ts`: copies of the array and of each annotation with its `lines` (the store's objects are frozen in development and actions change them in place), `index` = position in `current`, and copies equal to their original are swapped back for it so untouched rows keep their object.

The three options (`editable`, `linkEndpoints`, `isContinuousPlay`) are provider state that follows the prop (`useFollowedOption` in `packages/browser/src/providerInternals/useAnnotationState.ts`); the browser reads them with `useAnnotationOptions()` under both providers.

```typescript
const annotationStore = useCreateAnnotationStore(() => initialAnnotations);
<WaveformPlaylistProvider annotationStore={annotationStore} annotationList={{ editable: true }}>
```

**dnd-kit:** the Feedback plugin on the annotation resize handles is in the project skill `dnd-kit`, "Annotation resize handles".
