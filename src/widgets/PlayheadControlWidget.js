import { convert, minValMax, when } from "../misc/utilities.mjs";
import Playback from "../Playback";

export default class PlayheadControlWidget {
    timestring;
    constructor(element, playback) {
        this.element = element;
        this.playback = playback;
        this.element.onchange = e => this.handleInputChange(e);
        this.timestring = convert.secondsToTimeString(playback.playhead, '24');
        this.handlePlayheadChange();
        when(Playback.PLAYHEAD_CHANGED, () => this.handlePlayheadChange());
    }
    handlePlayheadChange() {
        this.element.value = convert.secondsToTimeString(this.playback.playhead, '24');
    }
    handleInputChange(e) {
        let test = convert.timeStringToSeconds(e.target.value);
        if (isNaN(test)) {
            this.element.value = this.timestring;
        } else {
            test = minValMax(this.playback.loopstart, test, this.playback.loopend);
            this.element.value = convert.secondsToTimeString(test, '24');
            this.timestring = this.element.value;
            this.playback.setPlayhead(test);
        }
    }
}