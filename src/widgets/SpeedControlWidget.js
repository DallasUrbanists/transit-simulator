import { when } from '../misc/utilities.mjs';
import Playback from '../Playback';

export default class SpeedControlWidget {
    constructor(element, playback) {
        this.element = element;
        this.playback = playback;
        this.element.onchange = e => this.playback.setSpeed(e.target.value);
        this.handleSpeedChange();
        when(Playback.SPEED_CHANGED, () => this.handleSpeedChange());
    }
    handleSpeedChange() {
        this.element.value = this.playback.speed;
    }
}