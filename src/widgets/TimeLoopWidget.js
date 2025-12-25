import { convert } from "../misc/utilities.mjs";

export default class TimeLoopWidget {
    loopstart = '00:00:00';
    loopend = '23:59:59';
    constructor(element, playback) {
        this.element = element;
        this.playback = playback;
        const handleChange = (e, part) => {
            const input = e.target;
            const test = convert.timeStringToSeconds(input.value);
            if (isNaN(test)) {
                input.value = part == 'start' ? this.loopstart : this.loopend;
            } else {
                input.value = convert.secondsToTimeString(test, '24');
                if (part == 'start') {
                    this.loopstart = input.value;
                    this.playback.loopstart = test;
                } else {
                    this.loopend = input.value;
                    this.playback.loopend = test;
                }
            }
        };
        this.startInput = element.querySelector('input[name="playback-loop-start"]');
        this.startInput.onchange = e => handleChange(e, 'start');
        this.loopstart = convert.secondsToTimeString(playback.loopstart, '24');
        this.endInput = element.querySelector('input[name="playback-loop-end"]');
        this.endInput.onchange = e => handleChange(e, 'end');
        this.loopend = convert.secondsToTimeString(playback.loopend, '24');
    }
}