export interface ViewportReadyDetail {
  trackId: string;
}

export type SpectrogramOrchestratorEventMap = {
  'viewport-ready': CustomEvent<ViewportReadyDetail>;
};
