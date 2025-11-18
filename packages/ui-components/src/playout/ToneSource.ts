import * as Tone from 'tone';

class ToneSource {
  private _tracks: any[];
  private _players: Map<string, Tone.Player> = new Map();

  constructor(tracks: any[] = []) {
    this._tracks = tracks;
  }
  async load() {
    this._tracks.forEach((track) => {
      debugger;
      const player = new Tone.Player({
        context: Tone.getContext(),
        url: track.src,
      }).chain(new Tone.Panner(track.pan), Tone.Destination);
      this._players.set(track.id, player);
    });

    return Tone.loaded();
  }

  start(time = 0) {
    this._players.forEach((player) => {
      player.start(time);
    });
  }

  stop(time = 0) {
    this._players.forEach((player) => {
      player.stop(time);
    });
  }
}

export { ToneSource };
