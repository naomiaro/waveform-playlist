import State from 'State';

export default class extends State {
    constructor(track) {
        super(track);

        this.track = track;
    }

    enter() {
        super.enter();  
    }

    leave() {
        super.leave();
    }

    static getClasses() {
        return "state-fadein";
    }
}