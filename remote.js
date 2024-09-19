const { io } = require('socket.io-client');
const { v5: uuidv5 } = require('uuid');
const sutils = require('.');

function Remote(remote, ipAddress, ipPort, output) {
    if (!process.env.REMOTE_SECRET) { throw new Error('REMOTE_SECRET is not set in environment variables.'); }

    this.secret = process.env.REMOTE_SECRET;
    this.remote = remote;
    this.remote.uuid = uuidv5(remote.title, this.secret);
    this.ipAddress = ipAddress;
    this.ipPort = ipPort;
    this.output = output;
    this.connected = null;
    this.first_connect = true;
    this.reconnecting = false;
    this.buffer = [];
    this.events = {};
}

Remote.prototype.connect = async function (opts) {
    this.socket = io(`http://${this.ipAddress}:${this.ipPort}/`);

    //If 'connect_error' then server is offline
    this.socket.on('connect_error', () => { 
        this.connected = false;
    });

    //If 'connect' then server is online
    this.socket.on('connect', () => {
        this.connected = true;
        this.sendInfo();
        this.first_connect = false;

        this.reconnecting = true;
        while (this.buffer.length > 0) { this.buffer.shift()(); }
        this.reconnecting = false;
    });

    //When button is pressed
    this.socket.on('press_button', async (data) => {
        var index = this.remote.buttons.findIndex(e => e.id == data?.button?.id);
        if (!this.remote.buttons[index] || !this.events['press_button']) { return; }
        if (!this.remote.buttons[index].enabled) { return; }
        await this.events['press_button'](data.button, data.payload, index, (data.mouse_button_id || 1), data.socketId);
        this.sendInfo();
    });

    //When button requires prefill
    this.socket.on('prefill_button', async (data) => {
        var index = this.remote.buttons.findIndex(e => e.id == data?.button?.id);
        if (!this.remote.buttons[index].enabled) { return; }
        this.remote.buttons[index].enabled = false;
        this.sendInfo();

        var b0 = (this.remote.buttons[index] && this.events['prefill_button']);
        if (b0) { await this.events['prefill_button'](data.button, index, data.socketId); }

        this.remote.buttons[index].enabled = true;
        this.sendInfo();

        if (!this.connected) { return; }
        this.socket.emit('prefill_button', { socketId: data.socketId, remoteId: data.remoteId, buttonId: data.button.id });
    });

    //When input to console is received
    this.socket.on('send_input', async (data) => { 
        if (!data?.text && (data?.text != '')) { return; }
        await this.sendInput(data.text);
    });

    //When client or server is requesting updated info (buttons may be updated)
    this.socket.on('update_info', async () => { 
        this.sendInfo();
    });

    //When recieving server time
    this.socket.on('get_time', async (data) => { 
        this.server_time = data.server_time;
    });

    //Wait until we either are connected or disconnected
    while (this.connected == null) { await sutils.Wait(1); }
    while (opts.wait && !this.connected) { await sutils.Wait(1); }
    return this.connected;
}

Remote.prototype.isConnected = function () {
    return this.connected;
}

Remote.prototype.on = function (event, callback) {
    this.events[event] = callback;
}

Remote.prototype.getTime = async function() {
    if (!this.connected) { return new Date; }
    this.socket.emit('get_time');
    while (!this.server_time) { await sutils.Wait(1); }

    var server_time = this.server_time;
    this.server_time = null;
    return new Date(server_time).getTime();
}

Remote.prototype.clearOutput = function() {
    if (!this.reconnecting) { console.clear(); }

    if (!this.reconnecting && (!this.connected || (this.buffer.length > 0))) {
        var callback = this.clearOutput.bind(this);
        return this.buffer.push(callback);
    }

    this.socket.emit('clear_output');
}

Remote.prototype.sendOutput = function(text, force) {
    if (!this.reconnecting && (this.output || force)) { process.stdout.write(text); }

    if (!this.reconnecting && (!this.connected || (this.buffer.length > 0))) {
        var callback = this.sendOutput.bind(this, text, force);
        return this.buffer.push(callback);
    }

    this.socket.emit('send_output', { text: text });
}

Remote.prototype.sendInput = async function(text) {
    if (this.events['send_input']) {
        var isAsync = (this.events['send_input'].constructor.name === 'AsyncFunction');
        if (isAsync) { await this.events['send_input'](text); }
        if (!isAsync) { this.events['send_input'](text); }
    }
}

Remote.prototype.sendInfo = function() {
    if (!this.connected) { return; }
    this.socket.emit('send_info', { secret: this.secret, first_connect: this.first_connect, remote: this.remote });
}

Remote.prototype.sendFile = function(socketId, fileName, buffer) {
    if (!this.connected) { return; }
    this.socket.emit('send_file', { socketId: socketId, fileName: fileName, buffer: buffer });
}

module.exports = Remote;