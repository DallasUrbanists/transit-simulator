import Playback from "../Playback";
import { $, convert, isTouch, isClick, getStored, store, dispatch, when } from "../misc/utilities.mjs";

const defaultPosition = { left: '60px', top: '60px' };
const defaultSize = '48px';
const defaultColor = 'white';

export default class ClockWidget {

    static POSITION_CHANGED = 'clock-position-changed';
    static SIZE_CHANGED = 'clock-size-changed';
    static COLOR_CHANGED = 'clock-color-changed';

    constructor(containerId, playback) {
        this.container = $('#'+containerId);
        this.playback = playback;
        this.setPosition(
            getStored('clock-left') ?? defaultPosition.left,
            getStored('clock-top') ?? defaultPosition.top
        );
        this.setSize(getStored('clock-size') ?? defaultSize);
        this.setColor(getStored('clock-color') ?? defaultColor);
        makeDraggable(this.container, ({ left, top }) => {
            this.setPosition(left, top);
        });
        when(Playback.PLAYHEAD_CHANGED, () => this.updateClock());
    }
    updateClock() {
        this.container.innerText = convert.secondsToTimeString(this.playback.playhead);
    }
    resetPosition() {
        this.setPosition(defaultPosition.left, defaultPosition.top);
    }
    setPosition(left, top) {
        this.container.style.left = left;
        this.container.style.top = top;
        store('clock-left', this.container.style.left);
        store('clock-top', this.container.style.top);
        dispatch(ClockWidget.POSITION_CHANGED, { left, top });
    }
    setSize(size) {
        this.size = size;
        this.container.style.fontSize = size;
        store('clock-size', size);
        dispatch(ClockWidget.SIZE_CHANGED, size);
    }
    setColor(color) {
        this.color = color;
        this.container.style.color = color;
        store('clock-color', color);
        dispatch(ClockWidget.COLOR_CHANGED, color);
    }
}

function makeDraggable(draggable, onMoveHandler = undefined) {
    let ogTop, ogLeft, mouseX, mouseY;
    draggable.onmousedown = e => dragMouseDown(e);
    draggable.ontouchstart = e => dragMouseDown(e);
    function dragMouseDown(e) {
        e.preventDefault();
        ogLeft = draggable.offsetLeft;
        ogTop = draggable.offsetTop;
        mouseX = e.clientX;
        mouseY = e.clientY;
        document.onmouseup = closeDragElement;
        document.ontouchend = closeDragElement;
        document.ontouchcancel = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchmove = elementDrag;
    }
    function elementDrag(e) {
        let deltaX, deltaY;
        deltaX = mouseX - e.clientX;
        deltaY = mouseY - e.clientY;
        // calculate new object position
        const newLeft = ogLeft - deltaX;
        const newTop = ogTop - deltaY;
        draggable.style.left = newLeft + "px";
        draggable.style.top = newTop + "px";
        if (onMoveHandler !== undefined) {
            onMoveHandler({ left: newLeft, top: newTop });
        }
    }
    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.ontouchend = null;
        document.onmousemove = null;
        document.ontouchmove = null;
    }
}