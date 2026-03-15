import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { DawEditorElement } from '../elements/daw-editor';

export class EngineController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  get editor(): DawEditorElement | null {
    return this._host.closest('daw-editor') as DawEditorElement | null;
  }

  hostConnected() {}
  hostDisconnected() {}
}
