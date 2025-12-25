import { convert, when } from "../misc/utilities.mjs";

export default class PlayheadJogWidget {
    constructor(element, playback) {
        this.element = element;
        this.playback = playback;
        this.jogButtons = element.querySelectorAll('button[data-direction][data-minutes]');
        this.jogButtons.forEach(button => button.onclick = e => {
            const direction = e.target.dataset.direction;
            const minutes = parseInt(e.target.dataset.minutes);
            const oldPlayhead = this.playback.playhead;
            const newPlayhead = direction === 'rewind'
                ? oldPlayhead - minutes * 60
                : oldPlayhead + minutes * 60;

            if (this.playback.isPlaying) {
                this.playback.pause();
                this.playback.setPlayhead(newPlayhead);
                this.playback.unpause();
            } else {
                this.playback.scrub(newPlayhead);
            }
        });
        this.nowButton = element.querySelector('button[name="playback-now"]');
        this.nowButton.onclick = e => {
            if (this.playback.isPlaying) {
                this.playback.pause();
                this.playback.setPlayhead(convert.nowInSeconds());
                this.playback.unpause();
            } else {
                this.playback.scrub(convert.nowInSeconds());
            }
        };
    }
}