const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const set = require('set-value');
const child_process = require('child_process');
const sha256File = require('sha256-file');
const zipper = require('zip-local');
const archiver = require('archiver');
const request = require('request');
const cliProgress = require('cli-progress');
const prettyBytes = require('pretty-bytes');
const isOnline = require('is-online');
const { v5: uuidv5, v4: uuidv4 } = require('uuid');

exports.Wait = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.IPV4Address = (vEthernet) => {
    if (process.env.DEBUG) { return '127.0.0.1'; }
    var interfaces = require('os').networkInterfaces();
    interfaces = Object.entries(interfaces).filter(e => (vEthernet ? true : !e[0].includes('vEthernet'))).map(e => e[1]).flat(1);
    interfaces = interfaces.filter(e => ((e.family === 'IPv4') && (e.address !== '127.0.0.1') && !e.internal));
    return interfaces[0] ? interfaces[0].address : '0.0.0.0';
}

exports.setProperties = (filename, name, value) => {
    var properties = fs.readFileSync(filename, 'utf8').split('\n');

    for (var i = 0; i < properties.length; i++) {
        if (properties[i].startsWith(name)) {
            properties[i] = name + value + '\r';
        }
    }

    fs.writeFileSync(filename, properties.join('\n'));
}

exports.getProperties = (filename, name) => {
    var properties = fs.readFileSync(filename, 'utf8').split('\n');

    for (var i = 0; i < properties.length; i++) {
        if (properties[i].startsWith(name)) {
            var value = properties[i].split('=');
            value.shift();
            return value.join('').trim();
        }
    }

    return '';
}

exports.setJSON = (json_file, property_path, value, space) => {
    var json = JSON.parse(fs.readFileSync(json_file, 'utf8'));
    set(json, property_path, value);
    fs.writeFileSync(json_file, JSON.stringify(json, null, space));
}

exports.getFileSize = (filename) => {
    return fs.statSync(filename).size;
}

exports.between = (num, a, b) => {
    var min = Math.min.apply(Math, [a, b]), max = Math.max.apply(Math, [a, b]);
    return (num != null) && (num >= min && num <= max);
};

exports.randomRange = (min, max) => {
    return Math.floor(Math.random()*(max-min+1)+min);
}

exports.pad = (num, places) => {
    return String(num).padStart(places, '0');
}

exports.generateString = (len, chars) => {
    var result = '';

    for (var i = 0; i < len; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
}

exports.getTimeString = () => {
    return new Date().toLocaleString('sv-SE');
}

exports.formatBytes = (bytes, after) => {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) { return '0 Byte'; }
    var i = parseInt(Math.floor(Math.log(bytes)/Math.log(1024)));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? after : 0) + ' ' + sizes[i];
}

exports.uuidv5 = (text) => {
    return uuidv5(text, 'b099c850-d32d-4bf3-a1b4-48af3b252c42');
}

exports.uuidv4 = (b0) => {
    return uuidv4().replace(b0 ? /-/g : '', '');
}

exports.isOnline = async () => {
    return await isOnline();
}

exports.execSync = async (command, options) => {
    return new Promise((resolve) => {
        var output = '';
        var child = child_process.exec(command, options);

        if (child.stdout) { child.stdout.on('data', (data) => { output += data }); }
        if (child.stderr) { child.stderr.on('data', (data) => { output += data }); }
        child.on('close', () => resolve(output));
    });
}

exports.spawnSync = async (command, options) => {
    var args = command.split(/\s+/);

    return new Promise((resolve) => {
        child_process.spawn(args.shift(), args, options).on('close', resolve);
    });
}

exports.rmSync = async (path, options) => {
    return new Promise((resolve) => {
        fs.rm(path, options, resolve);
    });
}

exports.copyFileSync = async (source, destination, mode) => {
    return new Promise((resolve) => {
        fs.copyFile(source, destination, mode, resolve);
    });
}

exports.copySync = async (source, destination, options) => {
    return new Promise((resolve) => {
        fse.copy(source, destination, options, resolve);
    });
}

exports.moveSync = async (source, destination, options) => {
    return new Promise((resolve) => {
        fse.move(source, destination, options, resolve);
    });
}

exports.readdirSync = async (path, options) => {
    return new Promise((resolve) => {
        fs.readdir(path, options, (err, files) => {
            if (err) { return resolve(err); }
            if (files) { return resolve(files); }
        });
    });
}

exports.afilter = async (arr, predicate) => {
    return Promise.all(arr.map(predicate)).then((results) => arr.filter((_v, index) => results[index]));
}

exports.sha256File = async (path) => {
    return new Promise((resolve) => {
        sha256File(path, (err, sum) => {
            if (err) { return resolve(err); }
            if (sum) { return resolve(sum); }
        });
    });
}

exports.zip = async (path, output, compress) => {
    return new Promise((resolve) => {
        zipper.zip(path, function(error, zipped) {
            if (error) { return resolve(error); }
            if (compress) { zipped.compress(); }
            zipped.save(output, resolve);
        });
    });
}

exports.zip_directory = async (path, output, level, subdir) => {
    return new Promise((resolve) => {
        if (level == undefined) { level = 9; }
        if (subdir == undefined) { subdir = true; }
        const archive = archiver('zip', { zlib: { level: level }});
        const stream = fs.createWriteStream(output);
        archive.directory(path, subdir).on('error', err => reject(err)).pipe(stream);
        stream.on('close', resolve);
        archive.finalize();
    });
}

exports.download = async (url, headers, filename, opts) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (!opts) { opts = {} }

    return new Promise(resolve => {
        const progressBar = new cliProgress.SingleBar({
            format: `${opts.text || filename.split('/').pop()} -> {bar} {percentage}% | {current_size}/{total_size}`
        }, cliProgress.Presets.shades_classic);

        var file = fs.createWriteStream(filename);
        var tracker = [0, 0];

        var req = request.get(url, headers).on('response', (res) => {
            tracker[1] = parseInt(res.headers['content-length']) || -1;

            progressBar.start(tracker[1], 0, {
                current_size: prettyBytes(tracker[0], { locale: 'de' }),
                total_size: prettyBytes(tracker[1], { locale: 'de' }),
            });

            if ((res.statusCode != 200) || (tracker[1] < 0)) {
                fs.unlinkSync(filename);
                progressBar.stop();
                resolve({ status: false, res: res });
            }
        });

        req.on('data', (chunk) => {
            progressBar.update((tracker[0] = tracker[0] += chunk.length), {
                current_size: prettyBytes(tracker[0], { locale: 'de' }),
                total_size: prettyBytes(tracker[1], { locale: 'de' }),
            });
        })

        req.on('error', () => {
            fs.unlinkSync(filename);
            progressBar.stop();
            resolve({ status: false });
        });

        file.on('finish', () => {
            progressBar.stop();
            file.close();
            resolve({ status: true });
        });

        file.on('error', () => {
            fs.unlinkSync(filename);
            progressBar.stop();
            resolve({ status: false });
        });
        
        req.pipe(file);
    });
}