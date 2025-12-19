import { convert } from "../misc/utilities.mjs";

export default class TimemarkControlWidget {
    timemark = '00:00:00';
    constructor(element, playback) {
        this.element = element;
        this.playback = playback;
        this.setButton = element.querySelector('button[name="playback-timemark-set"]');
        this.goButton = element.querySelector('button[name="playback-timemark-go"]');
        this.input = element.querySelector('input[name="playback-timemark-txt"]');
        this.input.onchange = () => {
            const test = convert.timeStringToSeconds(this.input.value);
            if (isNaN(test)) {
                this.input.value = this.timemark;
            } else {
                this.input.value = convert.secondsToTimeString(test, '24');
                this.timemark = this.input.value;
            }
        };
        this.setButton.onclick = () => {
            this.input.value = convert.secondsToTimeString(playback.playhead, '24');
        };
        this.goButton.onclick = () => {
            const newPlayhead = convert.timeStringToSeconds(this.input.value, '24');
            if (this.playback.isPlaying) {
                this.playback.pause();
                this.playback.setPlayhead(newPlayhead);
                this.playback.unpause();
            } else {
                this.playback.scrub(newPlayhead);
            }
        };
    }
}