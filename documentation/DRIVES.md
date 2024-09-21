# drives.js

A Node.js utility for managing Virtual Hard Disks (VHDs) and BitLocker encrypted drives, leveraging PowerShell for various disk operations.

## Features
- Check if a VHD is mounted.
- Retrieve disk numbers for mounted VHDs.
- List drive letters associated with VHD partitions.
- Get drive letters for BitLocker-protected volumes.
- Check if a drive is protected by BitLocker.
- Unlock and lock BitLocker drives using passwords.
- Efficiently manage and query local drives.

---

## API Documentation

### Methods:

#### `isVHDMounted(path)`
Checks if a VHD at the given path is currently mounted.

- `path` (string): The file path to the VHD.

#### `getVHDDiskNumber(path)`
Retrieves the disk number of the mounted VHD.

- `path` (string): The file path to the VHD.

#### `getVHDDrives(path)`
Lists the drive letters associated with the partitions of a mounted VHD.

- `path` (string): The file path to the VHD.

#### `getBitDrives()`
Returns a list of drive letters for volumes protected by BitLocker.

#### `getDrives()`
Lists all available drives of type 3 (local disks) with assigned drive letters.

#### `isBitLocker(drive)`
Checks if a specific drive is protected by BitLocker.

- `drive` (string): The drive letter to check.

#### `isBitLocked(drive)`
Determines if a BitLocker-protected drive is currently locked.

`drive` (string): The drive letter to check.

#### `unlockDrive(drive, password)`
Attempts to unlock a specified BitLocker drive using a provided password.

- `drive` (string): The drive letter to unlock.
- `password` (string): The password to unlock the drive.

#### `lockDrive(drive)`
Locks a specified BitLocker drive.

- `drive` (string): The drive letter to lock.