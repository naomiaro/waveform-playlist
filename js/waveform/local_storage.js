'use strict';

WaveformPlaylist.Storage = {

	save: function save(name, playlist) {
		var json = JSON.stringify(playlist);

		localStorage.setItem(name, json);
	},

	restore: function restore(name) {
		var JSONstring = localStorage.getItem(name),
				data;

		data = JSON.parse(JSONstring);

		return data;
	}
};
