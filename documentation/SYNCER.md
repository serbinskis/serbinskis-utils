# syncer.js

A Node.js utility class for synchronizing files and directories between two locations, supporting flexible synchronization modes, file handling, and error reporting.

## Features
- Synchronize files and directories between a source and a destination.
- Support for one-way and two-way synchronization.
- Flexible file overwriting rules based on date or source.
- Option to delete files and directories that are no longer present in the source.
- Ability to manage ignored files using `.gitignore` patterns.
- Custom callback functions for handling various operations and errors.


## Usage

### Initialize the Database

```js
const syncer = new Syncer({
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

await syncer.sync();
```

---

## API Documentation

### Constructor: `new Syncer(opts)`

Initializes a new `Syncer` instance.

#### Parameters:
- `opts`: An object with the following properties:
  - `source` (string): The source directory path.
  - `destination` (string): The destination directory path.
  - `copy_mode` (string): Mode for copying files (default: `'source'`).
  - `overwrite_priority` (string): Mode for overwriting files (default: `'source'`).
  - `sync_delete` (boolean): Whether to delete files not present in the source (default: `false`).
  - `sync_date` (boolean): Whether to sync modification dates (default: `false`).
  - `sync_overwrite` (boolean): Whether to overwrite existing files (default: `false`).
  - `delete_ignored` (boolean): Whether to delete ignored files in the destination (default: `false`).
  - `callback` (function): A callback function for handling operations and errors.

---

### Methods:

#### `sync()`
Synchronizes the files and directories between the source and destination.

#### `loadGitignore(filename)`
Loads a `.gitignore` file to manage ignored patterns.

- `filename` (string): Path to the `.gitignore` file.

#### `setGitignore(gitignore)`
Sets the `.gitignore` patterns dynamically.

- `gitignore` (array): An array of patterns to ignore.

#### `getCurrentFile()`
Returns the currently processed file during synchronization.

---

### Callbacks

The callback function receives parameters based on the operation performed:

- `operation`: The type of operation (e.g., `COPIED`, `DELETED_FILE`).
- `file1`: The source file or directory involved.
- `file2`: The destination file or directory involved.
- `location`: Indicates whether the operation is on `source` or `destination`.
- `counter`: A counter for the current file being processed.