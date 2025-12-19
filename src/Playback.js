import { convert, DAY, dispatch, minValMax, store } from "./misc/utilities.mjs";

const playheadChanged = new CustomEvent('playheadChanged');
const defaultLoopStart = 0;
const defaultLoopEnd = DAY-1;

export default class Playback {
    isPlaying = false;
    isPaused = false;
    speed = localStorage.getItem('playback-speed') ?? 32;
    playhead = convert.nowInSeconds();
    loopstart = 0;
    loopend = DAY - 1;
    playForward = true;
    isBouncing = false;

    #animationFrame;

    static SPEED_CHANGED = 'playback-speed-changed';
    static PLAYHEAD_CHANGED = 'playback-playhead-changed';
    static TOGGLED = 'playback-toggled';

    constructor(simulation) {
        this.render = seconds => simulation.render(seconds);
    }

    setSpeed(speed) {
        this.speed = speed;
        if (this.isPlaying) {
            window.cancelAnimationFrame(this.animationFrame);
            this.startTimestamp = performance.now();
            this.startPlayhead = this.playhead;
            this.animationFrame = requestAnimationFrame(t => this.pulse(t));
            dispatch(Playback.PLAYHEAD_CHANGED, this.playhead);
        }
        store('playback-speed', speed);
        dispatch(Playback.SPEED_CHANGED, speed);
    }

    setPlayhead = (seconds) => {
        this.playhead = minValMax(this.loopstart, seconds, this.loopend);
        dispatch(Playback.PLAYHEAD_CHANGED, this.playhead);
    };

    pulse(timestamp) {
        const deltaMilliseconds = Math.max(0, timestamp - this.startTimestamp);
        const deltaSeconds = (deltaMilliseconds * this.speed) / 1000;
        let newPlayhead = this.playForward
            ? this.startPlayhead + deltaSeconds
            : this.startPlayhead - deltaSeconds;
        if (newPlayhead > this.loopend) {
            if (this.isBouncing) {
                newPlayhead = this.loopend;
                this.playForward = false;
            } else {
                const loopduration = this.loopend - this.loopstart;
                const loopdelta = newPlayhead - this.loopend;
                if (loopdelta < loopduration) {
                    newPlayhead = this.loopstart + loopdelta;
                } else {
                    newPlayhead = this.loopstart;
                }
            }
            this.startTimestamp = timestamp;
            this.startPlayhead = newPlayhead;
        } else if (newPlayhead < this.loopstart) {
            if (this.isBouncing) {
                this.playForward = true;
            }
            console.log('this happend');
            newPlayhead = this.loopstart;
            this.startTimestamp = timestamp;
            this.startPlayhead = newPlayhead;
        }
        this.render(newPlayhead);
        this.setPlayhead(newPlayhead);
        if (this.isPlaying) {
            this.animationFrame = requestAnimationFrame(t => this.pulse(t));
        }
    }

    start() {
        this.stop();
        this.playForward = true;
        this.isPlaying = true;
        this.isPaused = false;
        this.startTimestamp = performance.now();
        this.startPlayhead = this.playhead;
        this.animationFrame = requestAnimationFrame(t => this.pulse(t));
        dispatch(Playback.PLAYHEAD_CHANGED, this.playhead);
        dispatch(Playback.TOGGLED);
    }

    rewind() {
        this.stop();
        this.playForward = false;
        this.isPlaying = true;
        this.isPaused = false;
        this.startTimestamp = performance.now();
        this.startPlayhead = this.playhead;
        this.animationFrame = requestAnimationFrame(t => this.pulse(t));
        dispatch(Playback.PLAYHEAD_CHANGED, this.playhead);
        dispatch(Playback.TOGGLED);
    }

    pause() {
        this.isPaused = true;
        this.stop();
    }

    unpause() {
        if (this.isPaused) {
            this.start();
        }
        this.isPaused = false;
    }

    stop() {
        this.isPlaying = false;
        window.cancelAnimationFrame(this.animationFrame);
        dispatch(Playback.PLAYHEAD_CHANGED, this.playhead);
        dispatch(Playback.TOGGLED);
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    scrub(playhead) {
        this.stop();
        this.setPlayhead(playhead);
        this.render(playhead);
    };

}