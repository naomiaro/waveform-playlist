import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type ClipTrack } from '@waveform-playlist/core';
import {
  configureGlobalContext,
  isNativeGlobalContext,
  supportsNativeContextMode,
} from '@waveform-playlist/playout';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  LoopButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  AutomaticScrollCheckbox,
  AudioPosition,
  KeyboardShortcuts,
} from '@waveform-playlist/browser';
import {
  useAudioTracks,
  useDynamicEffects,
  useTrackDynamicEffects,
  WamEffectGui,
  ExportWavButton,
  type ActiveEffect,
  type TrackActiveEffect,
} from '@waveform-playlist/browser/tone';
import { fetchWamLibrary, fetchWamDescriptor, type WamLibraryEntry } from '@dawcore/wam';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import {
  Container,
  Banner,
  StatusLine,
  Panel,
  PanelTitle,
  CountBadge,
  RacksRow,
  Row,
  Select,
  PrimaryButton,
  GhostButton,
  EmptyState,
  EntryCard,
  EntryHeader,
  EntryName,
  Badge,
  HeaderButtons,
  SmallButton,
  ParamGrid,
  ParamRow,
  ParamName,
  ParamSlider,
  ParamValue,
  GuiHost,
  CardGrid,
  PluginCard,
  CardThumb,
  CardName,
  CardMeta,
  Chips,
  Chip,
  CardButtons,
  DisabledNote,
  TransportBar,
} from './wamEffectsStyles';

// ---------------------------------------------------------------------------
// Native-context mode MUST be configured before any provider/hook creates the
// global AudioContext — WAM plugins are AudioWorklets that need a native
// context (Tone's standardized-audio-context shim can't host them). Firefox
// lacks the AudioListener position AudioParams the native path relies on, so
// we feature-detect and fall back gracefully (built-in Tone effects still run).
// ---------------------------------------------------------------------------
const wamSupported = typeof window !== 'undefined' && supportsNativeContextMode();
if (typeof window !== 'undefined' && wamSupported) {
  configureGlobalContext({ nativeAudioContext: true });
}

const COMMUNITY_MANIFEST = 'https://www.webaudiomodules.com/community/plugins.json';
const COMMUNITY_BASE = 'https://www.webaudiomodules.com/community/plugins/';

// A dependable WAM 2.0 effect for one-click demoing (the community registry
// still lists WAM 1.0 plugins, which createWamInstance rejects by apiVersion).
const QUICK_ADD_URL =
  'https://www.webaudiomodules.com/community/plugins/burns-audio/delay/index.js';
const QUICK_ADD_LABEL = 'Simple Delay';

// Whiptails stems — a manageable subset so per-track racks stay readable.
const audioConfigs = [
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/03_Kick.opus', name: 'Kick' },
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/07_Bass1.opus', name: 'Bass' },
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus', name: 'Synth' },
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/11_Vox_Dry.opus', name: 'Vox' },
];

// ---------------------------------------------------------------------------
// Community library hook
// ---------------------------------------------------------------------------

interface LibraryPlugin extends WamLibraryEntry {
  insertable: boolean;
}

type LibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

function useWamLibrary() {
  const [plugins, setPlugins] = useState<LibraryPlugin[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { entries } = await fetchWamLibrary(COMMUNITY_MANIFEST, { baseUrl: COMMUNITY_BASE });
      const withDescriptors = await Promise.all(
        entries.map(async (entry) => {
          const descriptor = await fetchWamDescriptor(entry.url);
          // Absent flags != false: the SDK runtime-defaults audio I/O to true.
          const audioIO =
            descriptor !== null
              ? descriptor.hasAudioInput !== false && descriptor.hasAudioOutput !== false
              : (entry.category ?? []).some((c) => c.toLowerCase() === 'effect');
          return { ...entry, insertable: audioIO };
        })
      );
      setPlugins(withDescriptors);
      setStatus('ready');
    } catch (err) {
      console.warn(
        '[wam-example] library fetch failed: ' + (err instanceof Error ? err.message : String(err))
      );
      setStatus('error');
    }
  }, []);

  return { plugins, status, load };
}

// ---------------------------------------------------------------------------
// A normalized rack-entry view — decouples the rack UI from the two different
// hook return types (ActiveEffect vs TrackActiveEffect).
// ---------------------------------------------------------------------------

interface ParamView {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  value: number;
}

function toParamViews(effect: ActiveEffect | TrackActiveEffect): ParamView[] {
  return effect.definition.parameters
    .filter((p) => p.type === 'number')
    .map((p) => ({
      name: p.name,
      label: p.label,
      min: p.min ?? 0,
      max: p.max ?? 1,
      step: p.step ?? 0.01,
      unit: p.unit,
      value: effect.params[p.name] as number,
    }));
}

function formatParam(value: number, unit?: string): string {
  const formatted =
    Math.abs(value) < 10
      ? value.toFixed(2)
      : Math.abs(value) < 100
        ? value.toFixed(1)
        : Math.round(value);
  return unit ? `${formatted}${unit}` : String(formatted);
}

interface RackEntryProps {
  effect: ActiveEffect | TrackActiveEffect;
  getPlugin: () => Parameters<typeof WamEffectGui>[0]['plugin'];
  onParam: (paramName: string, value: number) => void;
  onToggleBypass: () => void;
  onRemove: () => void;
}

const RackEntry: React.FC<RackEntryProps> = ({
  effect,
  getPlugin,
  onParam,
  onToggleBypass,
  onRemove,
}) => {
  const [showGui, setShowGui] = useState(true);
  const isWam = effect.kind === 'wam';
  const params = isWam ? [] : toParamViews(effect);

  return (
    <EntryCard>
      <EntryHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EntryName style={{ opacity: effect.bypassed ? 0.5 : 1 }}>
            {effect.definition.name}
          </EntryName>
          <Badge $kind={effect.kind}>{isWam ? 'WAM' : effect.definition.category}</Badge>
        </div>
        <HeaderButtons>
          {isWam && (
            <SmallButton $variant="muted" onClick={() => setShowGui((v) => !v)}>
              {showGui ? 'Hide GUI' : 'Show GUI'}
            </SmallButton>
          )}
          <SmallButton
            $variant={effect.bypassed ? 'muted' : 'active'}
            onClick={onToggleBypass}
            title={effect.bypassed ? 'Enable' : 'Bypass'}
          >
            {effect.bypassed ? 'Bypassed' : 'On'}
          </SmallButton>
          <SmallButton $variant="danger" onClick={onRemove}>
            Remove
          </SmallButton>
        </HeaderButtons>
      </EntryHeader>

      {isWam
        ? showGui && (
            <GuiHost>
              <WamEffectGui plugin={getPlugin()} />
            </GuiHost>
          )
        : params.length > 0 && (
            <ParamGrid>
              {params.map((p) => (
                <ParamRow key={p.name}>
                  <ParamName>{p.label}</ParamName>
                  <ParamSlider
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={p.value}
                    onChange={(e) => onParam(p.name, parseFloat(e.target.value))}
                  />
                  <ParamValue>{formatParam(p.value, p.unit)}</ParamValue>
                </ParamRow>
              ))}
            </ParamGrid>
          )}
    </EntryCard>
  );
};

// ---------------------------------------------------------------------------
// Rack — a titled effects chain (master or one track) with a built-in native
// effect picker. WAM inserts arrive from the library browser / quick-add bar.
// ---------------------------------------------------------------------------

interface RackProps {
  title: string;
  count: number;
  availableEffects: { id: string; name: string }[];
  onAddNative: (effectId: string) => void;
  children: React.ReactNode;
}

const Rack: React.FC<RackProps> = ({ title, count, availableEffects, onAddNative, children }) => {
  const [selected, setSelected] = useState('');

  const handleAdd = () => {
    if (selected) {
      onAddNative(selected);
      setSelected('');
    }
  };

  return (
    <Panel>
      <PanelTitle>
        {title}
        {count > 0 && <CountBadge>{count}</CountBadge>}
      </PanelTitle>
      <Row style={{ marginBottom: 12 }}>
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Add built-in effect…</option>
          {availableEffects.map((eff) => (
            <option key={eff.id} value={eff.id}>
              {eff.name}
            </option>
          ))}
        </Select>
        <PrimaryButton onClick={handleAdd} disabled={!selected}>
          Add
        </PrimaryButton>
      </Row>
      {children}
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// Library browser
// ---------------------------------------------------------------------------

interface LibraryBrowserProps {
  wamEnabled: boolean;
  addingKey: string | null;
  selectedTrackName: string;
  onAddWam: (url: string, label: string, target: 'master' | 'track') => void;
}

const LibraryBrowser: React.FC<LibraryBrowserProps> = ({
  wamEnabled,
  addingKey,
  selectedTrackName,
  onAddWam,
}) => {
  const { plugins, status, load } = useWamLibrary();

  return (
    <Panel>
      <PanelTitle>
        Community plugin library
        {plugins.length > 0 && <CountBadge>{plugins.length}</CountBadge>}
      </PanelTitle>

      <Row>
        <PrimaryButton onClick={load} disabled={status === 'loading'}>
          {status === 'loading'
            ? 'Loading…'
            : status === 'ready'
              ? 'Refresh library'
              : 'Browse community plugins'}
        </PrimaryButton>
        {wamEnabled && (
          <GhostButton
            onClick={() => onAddWam(QUICK_ADD_URL, QUICK_ADD_LABEL, 'master')}
            disabled={addingKey !== null}
          >
            + {QUICK_ADD_LABEL} → Master
          </GhostButton>
        )}
        <CardMeta>
          Plugins load from webaudiomodules.com (network required). WAM 1.0 entries are rejected on
          insert.
        </CardMeta>
      </Row>

      {status === 'error' && (
        <EmptyState style={{ marginTop: 12 }}>
          Could not reach the community library. webaudiomodules.com must be reachable.
          <div style={{ marginTop: 10 }}>
            <PrimaryButton onClick={load}>Retry</PrimaryButton>
          </div>
        </EmptyState>
      )}

      {status === 'ready' && plugins.length > 0 && (
        <CardGrid>
          {plugins.map((plugin) => {
            const masterKey = 'master::' + plugin.url;
            const trackKey = 'track::' + plugin.url;
            return (
              <PluginCard key={plugin.url}>
                {plugin.thumbnail && <CardThumb src={plugin.thumbnail} alt="" loading="lazy" />}
                <CardName>{plugin.name}</CardName>
                {plugin.vendor && <CardMeta>{plugin.vendor}</CardMeta>}
                {plugin.description && <CardMeta>{plugin.description}</CardMeta>}
                {plugin.category && plugin.category.length > 0 && (
                  <Chips>
                    {plugin.category.map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </Chips>
                )}
                <CardButtons>
                  {!plugin.insertable ? (
                    <DisabledNote>Instrument / no audio I/O — not insertable</DisabledNote>
                  ) : wamEnabled ? (
                    <>
                      <GhostButton
                        onClick={() => onAddWam(plugin.url, plugin.name, 'master')}
                        disabled={addingKey !== null}
                      >
                        {addingKey === masterKey ? 'Adding…' : '+ Master'}
                      </GhostButton>
                      <GhostButton
                        onClick={() => onAddWam(plugin.url, plugin.name, 'track')}
                        disabled={addingKey !== null}
                      >
                        {addingKey === trackKey ? 'Adding…' : `+ ${selectedTrackName}`}
                      </GhostButton>
                    </>
                  ) : (
                    <DisabledNote>WAM insert needs a native-context browser</DisabledNote>
                  )}
                </CardButtons>
              </PluginCard>
            );
          })}
        </CardGrid>
      )}
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// Transport + waveform + export (inside the provider)
// ---------------------------------------------------------------------------

interface WamControlsProps {
  loading: boolean;
  loadedCount: number;
  totalCount: number;
  offlineMaster?: ReturnType<ReturnType<typeof useDynamicEffects>['createOfflineEffectsFunction']>;
  createOfflineTrackEffects: ReturnType<
    typeof useTrackDynamicEffects
  >['createOfflineTrackEffectsFunction'];
}

const WamControls: React.FC<WamControlsProps> = ({
  loading,
  loadedCount,
  totalCount,
  offlineMaster,
  createOfflineTrackEffects,
}) => (
  <>
    <TransportBar>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <LoopButton />
      <ZoomInButton />
      <ZoomOutButton />
      <MasterVolumeControl />
      <AutomaticScrollCheckbox />
      <AudioPosition />
      <ExportWavButton
        label="Export Mix"
        filename="wam-mix"
        mode="master"
        applyEffects
        effectsFunction={offlineMaster ?? undefined}
        createOfflineTrackEffects={createOfflineTrackEffects}
      />
      {loading && (
        <span style={{ fontSize: '0.85rem', color: 'var(--ifm-color-emphasis-600)' }}>
          Loading: {loadedCount}/{totalCount}
        </span>
      )}
    </TransportBar>
    <Waveform />
  </>
);

// ---------------------------------------------------------------------------
// Main example
// ---------------------------------------------------------------------------

export function WamEffectsExample() {
  const { theme } = useDocusaurusTheme();

  // The module-scope configureGlobalContext() call above only runs once per
  // page load — if another audio example already created the global context
  // (e.g. via client-side navigation), it warns-and-ignores and native mode
  // never activates. Read the ACTUAL mode once per mount; it can't change
  // without a reload, so no state/effect is needed.
  const wamActive = wamSupported && isNativeGlobalContext();

  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const masterFx = useDynamicEffects(256);
  const trackFx = useTrackDynamicEffects();

  const {
    tracks: loadedTracks,
    loading,
    error,
    loadedCount,
    totalCount,
  } = useAudioTracks(audioConfigs, { immediate: true });

  useEffect(() => {
    if (loadedTracks.length > 0) {
      setTracks(loadedTracks);
      setSelectedTrackId((prev) => prev || loadedTracks[0].id);
    }
  }, [loadedTracks]);

  // Destructure the stable callback to satisfy exhaustive-deps.
  const { getTrackEffectsFunction } = trackFx;

  // Attach per-track effects functions so WAM/native inserts can be added live.
  // Depend on the stable callback, not the whole `trackFx` object (a fresh object
  // every render) — otherwise this memo recomputes on every render, producing new
  // track objects and forcing a full engine rebuild on every interaction.
  const tracksWithEffects = useMemo(
    () => tracks.map((track) => ({ ...track, effects: getTrackEffectsFunction(track.id) })),
    [tracks, getTrackEffectsFunction]
  );

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const selectedTrackName = selectedTrack?.name ?? 'Track';

  // Recompute offline export functions only when the effect chains change — the
  // master hook logs a WAM-skip warning each call, so we avoid per-render churn.
  const { createOfflineEffectsFunction } = masterFx;
  const offlineMaster = useMemo(
    () => createOfflineEffectsFunction(),
    [createOfflineEffectsFunction]
  );

  // Destructure stable callbacks to satisfy exhaustive-deps.
  const { addWamEffect } = masterFx;
  const { addWamEffectToTrack } = trackFx;

  const handleAddWam = useCallback(
    async (url: string, label: string, target: 'master' | 'track') => {
      const trackId = target === 'track' ? selectedTrackId : '';
      if (target === 'track' && !trackId) {
        setStatus({ tone: 'error', text: 'Select a track first.' });
        return;
      }
      const key = target + '::' + url;
      setAddingKey(key);
      setStatus(null);
      try {
        if (target === 'master') {
          await addWamEffect(url);
        } else {
          await addWamEffectToTrack(trackId, url);
        }
        setStatus({
          tone: 'ok',
          text:
            'Loaded "' +
            label +
            '" into ' +
            (target === 'master' ? 'the master chain' : selectedTrackName) +
            '.',
        });
      } catch (err) {
        setStatus({
          tone: 'error',
          text:
            'Could not load "' + label + '": ' + (err instanceof Error ? err.message : String(err)),
        });
      } finally {
        setAddingKey(null);
      }
    },
    [addWamEffect, addWamEffectToTrack, selectedTrackId, selectedTrackName]
  );

  const masterEntries = masterFx.activeEffects;
  const trackEntries = trackFx.trackEffectsState.get(selectedTrackId) ?? [];

  if (error) {
    return (
      <Container>
        <StatusLine $tone="error">Error loading audio: {error}</StatusLine>
      </Container>
    );
  }

  return (
    <Container>
      {!wamSupported && (
        <Banner>
          WAM plugins need a browser with native-context support (Chrome, Edge, Safari). The
          built-in Tone.js effects below still work in this browser.
        </Banner>
      )}

      {wamSupported && !wamActive && (
        <Banner>
          Another example already started this page's audio engine in compatibility mode. Reload
          this page to enable WAM plugins.
        </Banner>
      )}

      {status && <StatusLine $tone={status.tone}>{status.text}</StatusLine>}

      <LibraryBrowser
        wamEnabled={wamActive}
        addingKey={addingKey}
        selectedTrackName={selectedTrackName}
        onAddWam={handleAddWam}
      />

      <RacksRow>
        <Rack
          title="Master chain"
          count={masterEntries.length}
          availableEffects={masterFx.availableEffects}
          onAddNative={masterFx.addEffect}
        >
          {masterEntries.length === 0 ? (
            <EmptyState>
              No master effects. Add a built-in effect or a community WAM above.
            </EmptyState>
          ) : (
            masterEntries.map((effect) => (
              <RackEntry
                key={effect.instanceId}
                effect={effect}
                getPlugin={() => masterFx.getWamPlugin(effect.instanceId)}
                onParam={(name, value) => masterFx.updateParameter(effect.instanceId, name, value)}
                onToggleBypass={() => masterFx.toggleBypass(effect.instanceId)}
                onRemove={() => masterFx.removeEffect(effect.instanceId)}
              />
            ))
          )}
        </Rack>

        <div>
          <Row style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ifm-color-content-secondary, #666)' }}>
              Track rack:
            </span>
            <Select value={selectedTrackId} onChange={(e) => setSelectedTrackId(e.target.value)}>
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </Select>
          </Row>
          <Rack
            title={selectedTrackName + ' chain'}
            count={trackEntries.length}
            availableEffects={trackFx.availableEffects}
            onAddNative={(effectId) => trackFx.addEffectToTrack(selectedTrackId, effectId)}
          >
            {trackEntries.length === 0 ? (
              <EmptyState>No effects on this track yet.</EmptyState>
            ) : (
              trackEntries.map((effect) => (
                <RackEntry
                  key={effect.instanceId}
                  effect={effect}
                  getPlugin={() => trackFx.getTrackWamPlugin(selectedTrackId, effect.instanceId)}
                  onParam={(name, value) =>
                    trackFx.updateTrackEffectParameter(
                      selectedTrackId,
                      effect.instanceId,
                      name,
                      value
                    )
                  }
                  onToggleBypass={() => trackFx.toggleBypass(selectedTrackId, effect.instanceId)}
                  onRemove={() => trackFx.removeEffectFromTrack(selectedTrackId, effect.instanceId)}
                />
              ))
            )}
          </Rack>
        </div>
      </RacksRow>

      <WaveformPlaylistProvider
        tracks={tracksWithEffects}
        sampleRate={48000}
        onTracksChange={setTracks}
        deferEngineRebuild={loading}
        samplesPerPixel={512}
        zoomLevels={[256, 512, 1024, 2048, 4096]}
        waveHeight={100}
        theme={theme}
        controls={{ show: true, width: 150 }}
        automaticScroll
        effects={masterFx.masterEffects}
        timescale
        barWidth={2}
        barGap={0}
      >
        <KeyboardShortcuts playback />
        <WamControls
          loading={loading}
          loadedCount={loadedCount}
          totalCount={totalCount}
          offlineMaster={offlineMaster}
          createOfflineTrackEffects={trackFx.createOfflineTrackEffectsFunction}
        />
      </WaveformPlaylistProvider>
    </Container>
  );
}
