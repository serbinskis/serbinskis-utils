const fs = require('fs');
const got = require('got');
const request = require('request')
const AdmZip = require('adm-zip');
const sutils = require('.');

exports.steamCmdUrl = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip';
exports.steamWorkshopCollectionUrl = 'https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/';
exports.steamWorkshopItemUrl = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';

exports.getCollectionDetails = async (ids) => {
    if (!Array.isArray(ids)) { ids = [String(ids)]; }

    return new Promise((resolve) => {
        var requestData = { format: 'json', collectioncount: ids.length, publishedfileids: ids }

        request.post(exports.steamWorkshopCollectionUrl, { form: requestData, json: true }, function (err, res, data) {
            if (err) { return resolve(null); }
            if (!data || !data.response || !data.response.collectiondetails) { return resolve(null); }
            resolve(data.response.collectiondetails);
        })
    });
}

exports.getItemDetails = async (ids) => {
    if (!Array.isArray(ids)) { ids = [String(ids)]; }

    return new Promise((resolve) => {
        var requestData = { format: 'json', itemcount: ids.length, publishedfileids: ids }

        request.post(exports.steamWorkshopItemUrl, { form: requestData, json: true }, function (err, res, data) {
            if (err) { return resolve(null); }
            if (!data || !data.response || !data.response.publishedfiledetails) { return resolve(null); }
            resolve(data.response.publishedfiledetails);
        })
    });
}

exports.downloadSteamCmd = async (path) => {
    if (!fs.existsSync(`${path}/steamcmd.exe`)) {
        var steamcCmdZip = (await got(exports.steamCmdUrl)).rawBody;
        var zip = new AdmZip(steamcCmdZip);
        var steamCmdExe = zip.readFile(zip.getEntries()[0]);
        fs.mkdirSync(path, { recursive: true });
        fs.writeFileSync(`${path}/steamcmd.exe`, steamCmdExe);
    }
}

exports.downloadCollections = async (ids, path, opts, callback) => {
    //Get items from collection
    var details = await exports.getCollectionDetails(ids);
    ids = details.flatMap(e => e.children.map(e => e.publishedfileid));
    if (ids.length == 0) { return; }
    await exports.downloadItems(ids, path, opts, callback);
}

exports.downloadItems = async (ids, path, opts, callback) => {
    //Download steamcmd to temp directory
    if (!opts) { opts = {}; }
    opts.do_zip = opts.do_zip || false;
    opts.do_cleanup = (opts.do_cleanup !== undefined) ? opts.do_cleanup : true;
    opts.steam_dir = opts.steam_dir || `${process.env.TEMP}/steamcmd`;
    if (!callback) { callback = () => {}; }

    if (!fs.existsSync(`${opts.steam_dir}/steamcmd.exe`)) {
        callback('steam');
        await exports.downloadSteamCmd(opts.steam_dir);
        await sutils.spawnSync(`${opts.steam_dir}/steamcmd.exe +quit`);
    } else {
        await sutils.rmSync(`${opts.steam_dir}/steamapps/workshop`, { recursive: true, force: true });
    }

    //Get item details
    var items = await exports.getItemDetails(ids);
    var counter = 0;

    //Create destination path
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
    }

    //Download each item and copy it
    for (const item of items) {
        item.current = counter+++1; item.total = items.length;
        if (fs.existsSync(`${path}/${item.publishedfileid}`)) { continue; }
        if (!item.consumer_app_id && opts.consumer_app_id) { item.consumer_app_id = opts.consumer_app_id; }
        if (!item.creator_app_id && opts.creator_app_id) { item.creator_app_id = opts.creator_app_id; }
        if (!item.consumer_app_id) { callback('error_unlisted', false, item); continue; }
        if (item.consumer_app_id != item.creator_app_id) { callback('error_not_downloadable', false, item); continue; }
        callback('start', true, item);

        var workshop = `+workshop_download_item ${item.consumer_app_id} ${item.publishedfileid}`;
        await sutils.spawnSync(`${opts.steam_dir}/steamcmd.exe +login anonymous ${workshop} +quit`);
        //await sutils.execSync(`cmd.exe /c start /WAIT "" "${opts.steam_dir}/steamcmd.exe" +login anonymous ${workshop} +quit`);

        var arg0 = `${opts.steam_dir}/steamapps/workshop/content/${item.consumer_app_id}/${item.publishedfileid}`;
        var arg1 = fs.existsSync(arg0);

        if (opts.do_zip) {
            if (arg1) { await sutils.zip_directory(arg0, `${path}/${item.publishedfileid}.zip`, 9, `${item.publishedfileid}`); }
        } else {
            if (arg1) { await sutils.moveSync(arg0, `${path}/${item.publishedfileid}`, { overwrite: true }); }
        }

        await sutils.rmSync(`${opts.steam_dir}/steamapps/workshop`, { recursive: true, force: true });
        callback('end', arg1, item);
    }

    //Delete steamcmd
    if (opts.do_cleanup) { await sutils.rmSync(opts.steam_dir, { recursive: true, force: true }); }
}