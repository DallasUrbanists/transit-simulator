import { convert, DAY } from "./utilities.mjs";

const playheadChanged = new CustomEvent('playheadChanged');

export default class Playback {
    isPlaying = false;
    isPaused = false;
    speed = localStorage.getItem('playback_speed') ?? 32;
    playhead = convert.nowInSeconds();
    #animationFrame;

    constructor(simulation) {
        this.render = seconds => simulation.render(seconds);
    }

    setSpeed(speed) {
        this.speed = speed;
        localStorage.setItem('playback_speed', speed);
        if (this.isPlaying) {
            window.cancelAnimationFrame(this.animationFrame);
            this.startTimestamp = performance.now();
            this.startPlayhead = this.playhead;
            this.animationFrame = requestAnimationFrame(t => this.pulse(t));
        } else {
            this.dispatchUpdate();
        }
    }

    setPlayhead = (seconds) => {
        this.playhead = seconds;
        this.dispatchUpdate();
    };

    dispatchUpdate() {
        window.dispatchEvent(playheadChanged);
    }

    pulse(timestamp) {
        const deltaMilliseconds = Math.max(0, timestamp - this.startTimestamp);
        const deltaSeconds = (deltaMilliseconds * this.speed) / 1000;
        let newPlayhead = this.startPlayhead + deltaSeconds;
        if (newPlayhead > DAY) {
            newPlayhead = newPlayhead - DAY;
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
        this.isPlaying = true;
        this.isPaused = false;
        this.startTimestamp = performance.now();
        this.startPlayhead = this.playhead;
        this.animationFrame = requestAnimationFrame(t => this.pulse(t));
        this.dispatchUpdate();
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
        this.dispatchUpdate();
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