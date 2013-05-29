var Storage = function() {};

Storage.prototype.save = function save(name, playlist) {
    var json = JSON.stringify(playlist);

    localStorage.setItem(name, json);
};

Storage.prototype.restore = function restore(name) {
    var JSONstring = localStorage.getItem(name),
        data;

    data = JSON.parse(JSONstring);

    return data;
};
