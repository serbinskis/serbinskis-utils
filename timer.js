class Timer {
    static timers = {};
    static counter = 0;

    static start(cb, gap, opts) {
        if (!opts) { opts = {}; }
        opts.id = opts.id ? opts.id : ++Timer.counter;

        Timer.stop(opts.id);
        Timer.timers[opts.id] = [setTimeout(() => { Timer.finish(opts.id) }, gap), cb, gap, opts];

        if (opts.immediate) { cb(true); }
        delete opts.immediate;
        return opts.id;
    }

    static finish(id) {
        if (!Timer.timers[id]) { return; }

        try {
            Timer.timers[id][1]();
        } catch(e) {
            console.error(e);
        }

        if (!Timer.timers[id]) { return; }
        if (Timer.timers[id][3].interval) { Timer.change(id, Timer.timers[id][2]); }
        if (!Timer.timers[id][3].interval) { delete Timer.timers[id]; }
    }

    static stop(id) {
        if (!Timer.timers[id]) { return; }
        clearTimeout(Timer.timers[id][0]);
        delete Timer.timers[id];
    }

    static change(id, gap, opts) {
        if (!Timer.timers[id]) { return; }
        Timer.start(Timer.timers[id][1], gap, Object.assign(Timer.timers[id][3], opts || {}));
    }
}

module.exports = Timer;