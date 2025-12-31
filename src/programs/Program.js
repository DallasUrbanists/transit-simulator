export default class Program {
    constructor(mapContext) {
        this.map = mapContext;
    }
    async prepare(options) {
        throw new Error('prepare() method not implemented.');
    }
    isReady() {
        // Child class needs to apply logic that returns true
        return false;
    }
    render(playhead) {
        throw new Error('render() method not implemented.');
    }
}