const fs = require('fs');
const sutils = require('.');

//Note: Many of these operations require admin privileges
//Workaround: https://superuser.com/questions/1127182/unlock-bitlocked-data-drive-as-standard-user-on-the-command-line

exports.isVHDMounted = async (path) => {
    if (!fs.existsSync(path)) { return false; }
    var result = await sutils.execSync(`powershell -command "(Get-DiskImage '${path}').Attached"`);
    return result.toString().toLowerCase().includes('true');
}

exports.getVHDDiskNumber = async (path) => {
    if (!fs.existsSync(path)) { return -1; }
    if (!await exports.isVHDMounted(path)) { return -1; }

    try {
        var result = await sutils.execSync(`powershell -command "(Get-DiskImage '${path}').DevicePath"`);
    } catch (e) { return -1; }

    var number = result.toString().trim().toLowerCase().split('physicaldrive').pop();
    if (isNaN(number)) { return -1 } else { return Number(number); }
}

exports.getVHDDrives = async (path) => {
    if (!fs.existsSync(path)) { return []; }
    var disk = await exports.getVHDDiskNumber(path);
    if (disk < 0) { return []; }

    try {
        var result = await sutils.execSync(`powershell -command "(Get-Partition ${disk}).DriveLetter"`);
    } catch (e) { return []; }

    return result.toString().trim().split(/\r?\n/);
}

exports.getBitDrives = async () => {
    try {
        var result = await sutils.execSync(`powershell -command "((Get-BitLockerVolume -ErrorAction SilentlyContinue) | ? {$_.ProtectionStatus -ne 'Off'}).MountPoint"`);
        return result.toString().replace(/:/g, '').trim().toUpperCase().split(/\r?\n/);
    } catch (e) { return []; }
}

exports.getDrives = async () => {
    try {
        var result = await sutils.execSync(`powershell -command "(get-wmiobject win32_volume | ? {$_.DriveType -eq 3 -and $_.DriveLetter}).DriveLetter"`);
    } catch (e) { return []; }

    return result.toString().replace(/:/g, '').trim().toUpperCase().split(/\r?\n/);
}

exports.isBitLocker = async (drive) => {
    return (await exports.getBitDrives()).includes(drive.toUpperCase());
}

exports.isBitLocked = async (drive) => {
    return (await exports.isBitLocker(drive) && !fs.existsSync(`${drive}:\\`));
}

exports.unlockDrive = async (drive, password) => {
    if (!(await exports.getDrives()).includes(drive.toUpperCase())) { return false; }

    try {
        var result = await sutils.execSync(`powershell -command "Unlock-BitLocker -MountPoint '${drive}:' -Password (ConvertTo-SecureString '${password}' -AsPlainText -Force)"`);
        return result.toString().toLowerCase().includes('computername') || fs.existsSync(`${drive}:\\`);
    } catch (e) { return false; }
}

exports.lockDrive = async (drive) => {
    if (!(await exports.getDrives()).includes(drive.toUpperCase())) { return false; }
    if (await exports.isBitLocked(drive)) { return true; }

    try {
        var result = await sutils.execSync(`powershell -command "Lock-BitLocker -MountPoint '${drive}:'"`);
        return result.toString().toLowerCase().includes('computername') || !fs.existsSync(`${drive}:\\`);
    } catch (e) { return false; }
}