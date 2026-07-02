import React, { useEffect, useRef } from 'react';
import type { WamPluginInstance, WamParameterPanelNode } from '@dawcore/wam';
import { loadWamModule } from '../effects/loadWam';

export interface WamEffectGuiProps {
  /** Live plugin handle from getWamPlugin/getTrackWamPlugin. */
  plugin: WamPluginInstance | undefined;
  className?: string;
}

/**
 * Mounts a WAM plugin's own GUI (plugin.createGui), falling back to the
 * generic parameter panel from @dawcore/wam for headless plugins. The GUI is
 * destroyed on unmount — GUI and audio lifecycles are independent, so this
 * never interrupts sound.
 */
export const WamEffectGui: React.FC<WamEffectGuiProps> = ({ plugin, className }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!plugin || !host) return;
    let cancelled = false;
    let gui: HTMLElement | null = null;

    (async () => {
      try {
        if (plugin.createGui) {
          gui = await plugin.createGui();
        } else {
          const wam = await loadWamModule();
          gui = await wam.createWamParameterPanel(
            plugin.audioNode as unknown as WamParameterPanelNode
          );
        }
        if (cancelled) {
          if (gui) {
            try {
              plugin.destroyGui?.(gui);
            } catch (destroyErr) {
              console.warn(
                '[waveform-playlist] Error destroying WAM GUI: ' +
                  (destroyErr instanceof Error ? destroyErr.message : String(destroyErr))
              );
            }
          }
          gui = null;
          return;
        }
        host.innerHTML = '';
        host.appendChild(gui);
      } catch (err) {
        console.warn(
          '[waveform-playlist] Failed to create WAM GUI: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    })();

    return () => {
      cancelled = true;
      if (gui) {
        gui.remove();
        try {
          plugin.destroyGui?.(gui);
        } catch (destroyErr) {
          console.warn(
            '[waveform-playlist] Error destroying WAM GUI: ' +
              (destroyErr instanceof Error ? destroyErr.message : String(destroyErr))
          );
        }
      }
    };
  }, [plugin]);

  return <div ref={hostRef} className={className ?? 'wam-effect-gui'} />;
};
