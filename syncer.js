const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const utimes = require('utimes');
const parser = require('@gerhobbelt/gitignore-parser');

/* Example
var syncer = new Syncer({
    source: 'D:/',
    destination: 'R:/',
    copy_mode: 'source',
    overwrite_priority: 'source',
    sync_delete: true,
    sync_date: true,
    sync_overwrite: true,
    delete_ignored: true,
    callback: (operation, file1, file2, location, counter) => {
        switch (operation) {
            case 'ROOT_ERROR': { var message = `[${new Date().toLocaleString('sv-SE')}] Error with root: "${file1}"\n`; break; }
            case 'FILE_ERROR': { var message = `[${new Date().toLocaleString('sv-SE')}] Error file: "${file1}" is corrupted or inaccessible\n`; break; }
            case 'FILE_ACCESS_ERROR': { var message = `[${new Date().toLocaleString('sv-SE')}] Error accessing file: "${file1}" is inaccessible or locked\n`; break; }
            case 'FILE_COPY_ERROR': { var message = `[${new Date().toLocaleString('sv-SE')}] Error copying file: "${file1}" to "${file2}"\n`; break; }
            case 'DIRECTORY_READ_ERROR': { var message = `[${new Date().toLocaleString('sv-SE')}] Error reading directory: "${file1}"\n`; break; }
            case 'CREATED_DIRECTORY': { var message = `[${new Date().toLocaleString('sv-SE')}] Created directory: "${file1}"\n`; break; }
            case 'DELETED_DIRECTORY': { var message = `[${new Date().toLocaleString('sv-SE')}] Deleted directory: "${file1}"\n`; break; }
            case 'DELETED_FILE': { var message = `[${new Date().toLocaleString('sv-SE')}] Deleted file: "${file1}"\n`; break; }
            case 'DELETED_ERROR': { var message = `[${new Date().toLocaleString('sv-SE')}] Delete file error: "${file1}"\n`; break; }
            case 'COPIED': { var message = `[${new Date().toLocaleString('sv-SE')}] Copied file: "${file1}" to "${file2}"\n`; break; }
            case 'SYNC_DATE': { var message = `[${new Date().toLocaleString('sv-SE')}] Synced date: "${file2}" with "${file1}"\n`; break; }
            case 'OVERWRITTEN': { var message = `[${new Date().toLocaleString('sv-SE')}] Overwritten file: "${file2}" with "${file1}"\n`; break; }
            case 'CURRENT_FILE': { process.title = `[${counter}]: ${file1}`; return; }
        }

        process.stdout.write(message);
    }
});
*/

function Syncer(opts) {
    this.files = {}
    this.created = {}
    this.current_file = null;
    this.source = opts.source || '';
    this.destination = opts.destination || '';
    this.gitignore = opts.gitignore || [];

    //How to copy: 'source' -> destination, 'destination' -> source, 'both' <-> both
    this.copy_mode = opts.copy_mode || 'source';

    //How to overwrite: from 'source', from 'destination' or by 'date'
    this.overwrite_priority = opts.overwrite_priority || 'source';

    //Should files be deleted, if no it will only copy new ones or overwrite existing
    this.sync_delete = opts.sync_delete || false;

    //Will check modification date and also sync them
    //If files have same dates the hash check will be skipped, and therefore better performance
    //If dates are different files will be checked and dates synced from source to destination
    this.sync_date = opts.sync_date || false;

    //Should files be overwriten, if not it will only new ones or delete existing
    this.sync_overwrite = opts.sync_overwrite || false;

    //Should ignored files be deleted, ignored in source not in the destination
    this.delete_ignored = opts.delete_ignored || false;

    this.callback = opts.callback || (() => {});
    this.git = parser.compile(this.gitignore.join('\n'));
}

Syncer.prototype.existsAsync = async (path) => {
    return new Promise(resolve => fs.exists(path, resolve));
}

Syncer.prototype.copyFileAsync = async (source, destination, mode) => {
    return new Promise(resolve => fs.copyFile(source, destination, mode, resolve));
}

Syncer.prototype.sha256Async = async (file) => {
    return new Promise(resolve => {
        var hash = crypto.createHash('sha256');
        var fileStream = fs.createReadStream(file);
        fileStream.on('error', (err) => resolve(null));
        fileStream.on('data', (chunk) => { try { hash.update(chunk) } catch (err) { resolve(null) } });
        fileStream.on('end', () => resolve(hash.digest('hex')));
    });
}

Syncer.prototype.compare = async function (file1, file2) {
    if (!(await this.existsAsync(file1)) || !(await this.existsAsync(file2))) { return false; }
    var hash1 = this.files[file1] || (this.files[file1] = (await this.sha256Async(file1)));
    var hash2 = this.files[file2] || (this.files[file2] = (await this.sha256Async(file2)));
    return (hash1 == hash2);
}

Syncer.prototype.handleDirectory = async function (path, location, date) {
    var destination = path.replace(((location == 'source') ? this.source : this.destination), ((location == 'source') ? this.destination : this.source));

    if (date && this.sync_date) { return this.handleDirectoryDate(path, destination, location); }
    if (await this.handleDirectoryDelete(path, destination, location)) { return; }
    if (await this.handleDirectoryCreate(path, destination, location)) { return; }
    if (await this.handleIgnoredDirectory(path, destination, location)) { return; }
}

Syncer.prototype.handleDirectoryDelete = async function (path, destination, location) {
    if (await this.existsAsync(destination)) { return false; }

    if ((this.copy_mode != location) && this.sync_delete) {
        await fs.promises.rm(path, { recursive: true, force: true });
        await this.callback('DELETED_DIRECTORY', path);
        return true;
    }

    return false;
}

Syncer.prototype.handleDirectoryCreate = async function (path, destination, location) {
    if (await this.existsAsync(destination)) { return false; }

    //Cannot update date here, because it will be overwritten,
    //Later when we copy files to it.

    if ((this.copy_mode == location) || (this.copy_mode == 'both')) {
        await fs.promises.mkdir(destination, { recursive: true });
        await this.callback('CREATED_DIRECTORY', destination);
        this.created[destination] = true;
        return true;
    }

    return false;
}

Syncer.prototype.handleDirectoryDate = async function (path, destination, location) {
    if (await !this.existsAsync(destination)) { return false; }

    if ((this.copy_mode == location) || (this.copy_mode == 'both')) {
        var stats_f1 = await fs.promises.stat(path);
        var stats_f2 = await fs.promises.stat(destination);
        var time_diff = stats_f2.mtime.getTime() - stats_f1.mtime.getTime();

        if ((time_diff != 0)) { await utimes.utimes(destination, { btime: stats_f1.birthtime.getTime(), mtime: stats_f1.mtime.getTime(), atime: 0 }); }
        if (!this.created[destination] && (time_diff != 0)) { await this.callback('SYNC_DATE', path, destination); }
        return true;
    }

    return false;
}

Syncer.prototype.handleIgnoredDirectory = async function (path, destination, location) {
    if (!this.sync_delete || !this.delete_ignored) { return false; }
    if (!(await this.existsAsync(path))) { await this.callback('FILE_ERROR', path, destination); return false; }

    var flag0 = !this.git.accepts(path);
    var flag1 = !this.git.accepts(destination);

    //If two way sync, then delete only if only source is ignored
    if (this.copy_mode == 'both') {
        if ((this.copy_mode != location) && !flag0 && flag1) {
            try { await fs.promises.rmdir(path, { force: true }); } catch(e) { return false; }
            await this.callback('DELETED_DIRECTORY', path);
        }
        return false;
    }

    //If one way sync, then delete if source is ignored
    //Delete destination, no mather if it is also ignored, since delete_ignored
    if ((this.copy_mode != location) && flag1) {
        try { await fs.promises.rmdir(path, { force: true }); } catch(e) { return false; }
        await this.callback('DELETED_DIRECTORY', path);
        return false;
    }

    return false;
}

Syncer.prototype.handleFile = async function (file, location) {
    //if ((this.copy_mode == 'source') && (location != 'source')) { return; }
    //if ((this.copy_mode == 'destination') && (location != 'destination')) { return; }
    var destination = file.replace(((location == 'source') ? this.source : this.destination), ((location == 'source') ? this.destination : this.source));

    this.current_file = [file, destination, location, ((this.current_file || [])[3] || 0)+1];
    await this.callback('CURRENT_FILE', file, destination, location, this.current_file[3]);
    if (!(await this.existsAsync(file))) { await this.callback('FILE_ERROR', file, destination); return; }

    if (await this.handleFileAccess(file, destination, location)) { return; }
    if (await this.handleFileDelete(file, destination, location)) { return; }
    if (await this.handleIgnoredFile(file, destination, location)) { return; }
    if (await this.handleFileCopy(file, destination, location)) { return; }
    if (await this.handleFileOverwrite(file, destination, location)) { return; }
}

Syncer.prototype.handleFileAccess = async function (file1, file2, location) {
    //If there is access to file then everything is ok
    //Otherwise, we skip this file as handled, therefore we return true

    try {
        await fs.promises.access(file1, fs.constants.R_OK);
    } catch (e) {
        await this.callback('FILE_ACCESS_ERROR', file1, file2, location);
        return true;
    }

    return false;
}

Syncer.prototype.handleFileDelete = async function (file1, file2, location) {
    if (!this.sync_delete || (await this.existsAsync(file2))) { return false; }
    if (this.copy_mode == 'both') { return false; }

    if (this.copy_mode != location) {
        await fs.promises.unlink(file1);
        await this.callback('DELETED_FILE', file1);
        return true;
    }

    return false;
}

Syncer.prototype.handleIgnoredFile = async function (file1, file2, location) {
    if (!this.sync_delete || !this.delete_ignored) { return false; }
    var flag0 = !this.git.accepts(file1);
    var flag1 = !this.git.accepts(file2);

    //If two way sync, then delete only if only source is ignored
    if (this.copy_mode == 'both') {
        if ((this.copy_mode != location) && !flag0 && flag1) {
            try { await fs.promises.unlink(file1); } catch(e) { await this.callback('DELETED_ERROR', file1); return false; }
            await this.callback('DELETED_FILE', file1);
        }
        return ((this.copy_mode != location) && !flag0 && flag1);
    }

    //If one way sync, then delete if source is ignored
    //Delete destination, no mather if it is also ignored, since delete_ignored
    if ((this.copy_mode != location) && flag1) {
        try { await fs.promises.unlink(file1); } catch(e) { await this.callback('DELETED_ERROR', file1); return false; }
        await this.callback('DELETED_FILE', file1);
        return true;
    }

    return false;
}

Syncer.prototype.handleFileCopy = async function (file1, file2, location) {
    if ((await this.existsAsync(file2))) { return false; }
    //this.copyFileAsync() - only returns error if such happened

    if ((this.copy_mode == location) || (this.copy_mode == 'both')) {
        var dirname = path.dirname(file2); var stats_f1 = await fs.promises.stat(file1);
        if (!(await this.existsAsync(dirname))) { await fs.promises.mkdir(dirname, { recursive: true }); }
        if (await this.copyFileAsync(file1, file2)) { await this.callback('FILE_COPY_ERROR', file1, file2); return true; }
        if (!(await this.existsAsync(file2))) { await this.callback('FILE_COPY_ERROR', file1, file2); return true; }
        if (this.sync_date) { await utimes.utimes(file2, { btime: stats_f1.birthtime.getTime(), mtime: stats_f1.mtime.getTime(), atime: 0 }); }
        await this.callback('COPIED', file1, file2);
        return true;
    }

    return false;
}

//!await this.existsAsync(file1) - even tho file is there, it might be corrupted or inaccessible
//which will cause an error in that case, so it's better to make check, just in case
Syncer.prototype.handleFileOverwrite = async function (file1, file2, location) {
    if (!this.sync_overwrite || !(await this.existsAsync(file2))) { return false; }

    var stats_f1 = await fs.promises.stat(file1); var stats_f2 = await fs.promises.stat(file2);
    var time_diff = stats_f2.mtime.getTime() - stats_f1.mtime.getTime();
    var size_diff = stats_f2.size - stats_f1.size;
    var b_comapre = this.sync_date ? false : await this.compare(file1, file2);

    //If file is same by date and size, no need for comparison, just return
    if (this.sync_date && (time_diff == 0) && (size_diff == 0)) { return false; } 

    //If file date are different but size are same, we need to compare file hash
    if (this.sync_date && (time_diff != 0) && (size_diff == 0)) { b_comapre = await this.compare(file1, file2); }

    //Idk, I don't remember what this does, I guess it checks if we can copy file by location (not sure)
    var isPriority = ((this.overwrite_priority == 'date') && (time_diff < 0)) || ((this.overwrite_priority != 'date') && (this.overwrite_priority == location));
    if (!(((this.copy_mode == location) || (this.copy_mode == 'both')) && isPriority)) { return false; }

    //Overwrite file, or just sync dates
    if (this.sync_date && b_comapre && (time_diff != 0)) {
        await utimes.utimes(file2, { btime: stats_f1.birthtime.getTime(), mtime: stats_f1.mtime.getTime(), atime: 0 });
        await this.callback('SYNC_DATE', file1, file2);
        return true;
    } else if (!b_comapre) {
        await fs.promises.unlink(file2);
        if (await this.copyFileAsync(file1, file2)) { await this.callback('FILE_COPY_ERROR', file1, file2); return true; }
        if (!(await this.existsAsync(file2))) { await this.callback('FILE_COPY_ERROR', file1, file2); return true; }
        if (this.sync_date) { await utimes.utimes(file2, { btime: stats_f1.birthtime.getTime(), mtime: stats_f1.mtime.getTime(), atime: 0 }); }
        await this.callback('OVERWRITTEN', file1, file2);
        return true;
    }

    return false;
}

Syncer.prototype.handleIgnored = async function (file, filename, location) {
    if (!this.sync_delete) { return; }
    var destination = filename.replace(((location == 'source') ? this.source : this.destination), ((location == 'source') ? this.destination : this.source));

    if (file.isFile()) {
        this.current_file = [filename, destination, location, ((this.current_file || [])[3] || 0)+1];
        await this.callback('CURRENT_FILE', filename, destination, location, this.current_file[3]);
        if (await this.handleFileAccess(filename, destination, location)) { return; }
        await this.handleIgnoredFile(filename, destination, location);
    }

    if (file.isDirectory() || file.isSymbolicLink()) {
        await this.recurse(filename, location);
        await this.handleIgnoredDirectory(filename, destination, location);
    }
}

Syncer.prototype.recurse = async function (path, location) {
    try {
        if (!(await this.existsAsync(path))) { return; }
        var files = await fs.promises.readdir(path, { withFileTypes: true });
    } catch (e) {
        return await this.callback('DIRECTORY_READ_ERROR', path, null, location);
    }

    for (const file of files) {
        var filename = `${path}/${file.name}`;

        if (!this.git.accepts(filename)) {
            await this.handleIgnored(file, filename, location);
            continue;
        }

        if (file.isFile()) {
            await this.handleFile(filename, location);
        }

        if (file.isDirectory() || file.isSymbolicLink()) {
            await this.handleDirectory(filename, location, false); //First handle folder, for example, create it
            await this.recurse(filename, location); //Only then procced to subfolders
            await this.handleDirectory(filename, location, true); //Sync dates
        }
    }
}

Syncer.prototype.sync = async function () {
    var source = path.parse(path.resolve(this.source));
    var destination = path.parse(path.resolve(this.destination));
    if (!(await this.existsAsync(source.root))) { return await this.callback('ROOT_ERROR', this.source, null); }
    if (!(await this.existsAsync(destination.root))) { return await this.callback('ROOT_ERROR', null, this.destination); }
    if (path.format(source).toLowerCase() == path.format(destination).toLowerCase()) { return await this.callback('ROOT_ERROR', this.source, this.destination); }

    this.files = {}
    await this.recurse(this.source, 'source');
    await this.recurse(this.destination, 'destination');
    this.current_file = null;
    this.files = {}
    this.created = {};
}

Syncer.prototype.loadGitignore = function (filename) {
    if (!(fs.existsSync(filename))) { return false; }
    this.gitignore = fs.readFileSync(filename, { encoding:'utf8' }).split(/\r?\n/);
    this.git = parser.compile(this.gitignore.join('\n'));
    return true;
}

Syncer.prototype.setGitignore = function (gitignore) {
    this.gitignore = gitignore;
    this.git = parser.compile(this.gitignore.join('\n'));
}

Syncer.prototype.getCurrentFile = function (gitignore) {
    return this.current_file;
}

module.exports = Syncer;