import { $, DAY, minValMax, when } from "../misc/utilities.mjs";
import Playback from "../Playback";

export default class ProgressBarWidget {
    scrubTimer;
    constructor(elementId, playback) {
        this.playback = playback;
        this.track = $('#'+elementId);
        this.bar = this.track.getElementsByClassName('progress-bar')[0];
        this.track.addEventListener('mousedown', e => this.startScrubbing(e));
        window.addEventListener('mouseup', e => this.stopScrubbing(e));
        when(Playback.PLAYHEAD_CHANGED, () => this.moveBar());
    }
    scrubOnce(event) {
        this.moveBar(this.getClickRatio(event));
        const playhead = DAY * this.getClickRatio(event);
        this.playback.scrub(playhead);
    }
    keepScrubbing(event) {
        this.moveBar(this.getClickRatio(event));
        clearTimeout(this.scrubTimer);
        this.scrubTimer = setTimeout(() => this.scrubOnce(event), 10);
    }
    startScrubbing(event) {
        if (this.playback.isPlaying) this.playback.pause();
        this.track.onmousemove = e => this.keepScrubbing(e);
        this.scrubOnce(event);
    }
    stopScrubbing() {
        this.playback.unpause();
        this.track.onmousemove = null;
    }
    moveBar(ratio = undefined) {
        if (ratio === undefined) ratio = minValMax(0, this.playback.playhead / DAY, 1);
        const barWidth = this.track.offsetWidth * ratio;
        this.bar.style.width = barWidth + 'px';
        if (this.playback.isPlaying) {
            this.bar.classList.add('pulsing-element');
        } else {
            this.bar.classList.remove('pulsing-element');
        }
    }
    getClickRatio(event) {
        return Math.max(0, (event.clientX - this.track.getBoundingClientRect().left)) / this.track.offsetWidth;
    }

}

// Briefly show the "Exit Fullscreen" button when user moves mouse
/*let showTimeout;
window.addEventListener('mousemove', () => {
    $('#leave-fullscreen').classList.add('show');
    clearTimeout(showTimeout);
    showTimeout = setTimeout(() => $('#leave-fullscreen').classList.remove('show'), 1000);
});*/


// Update the control bar UI to show the current playhead time, adjust progress bar width, and toggle play button
