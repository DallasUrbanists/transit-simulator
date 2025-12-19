import { $, when } from "../misc/utilities.mjs";
import Playback from "../Playback";

const pauseIcon = './icons/pause.svg';
const playIcon = './icons/play.svg';

export default class PlayPauseButton {
    constructor(element, playback) {
        this.element = element;
        this.image = this.element.getElementsByTagName('img')[0];
        this.playback = playback;
        this.element.onclick = () => this.playback.toggle();
        when(Playback.TOGGLED, () => this.handleToggle())
    }
    handleToggle() {
        this.image.src = this.playback.isPlaying ? pauseIcon : playIcon;
    }
}