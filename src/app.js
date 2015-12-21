import Delegator from 'dom-delegator';
import EventEmitter from 'event-emitter';

import Config from './Config';
import Playlist from './Playlist';

export function init(options={}, ee=EventEmitter(), delegator=Delegator()) {
	if (options.container === undefined) {
        throw new Error("DOM element container must be given.");
    }

    let container = options.container;
    delete options.container;

    let config = new Config(options);

	let playlist = new Playlist();
	playlist.setConfig(config);
	playlist.setContainer(container);
	playlist.setEventEmitter(ee);
	playlist.setUpEventEmitter();
	playlist.setTimeSelection(0, 0);

	//have to add extra events that aren't followed by default.
	delegator.listenTo("scroll");

	return playlist;
}