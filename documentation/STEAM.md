# steam.js

A Node.js utility for managing Steam Workshop items, enabling the download of collections and individual items using SteamCMD.

## Features
- Download SteamCMD if not already installed.
- Retrieve details of Steam Workshop collections.
- Fetch details of individual Workshop items.
- Download entire collections or specific items.
- Support for zipping downloaded items.
- Cleanup of temporary files and directories.

---

## API Documentation

### Methods:

#### `getCollectionDetails(ids)`
Retrieves details about a workshop collection based on given IDs.

- `ids` (array|string): An array of collection IDs or a single ID.

### `getItemDetails(ids)`
Fetches details for specific workshop items.

- `ids` (array|string): An array of item IDs or a single ID.

### `downloadSteamCmd(path)`
Downloads SteamCMD to the specified path if it does not already exist.

- `path` (string): The directory where SteamCMD will be downloaded.

### `downloadCollections(ids, path, opts, callback)`
Downloads all items in a specified collection.

- `ids` (array|string): Collection ID(s).
- `path` (string): Destination path for downloaded items.
- `opts` (object): Options for downloading.
- `callback` (function): Callback function for tracking progress.

### `downloadItems(ids, path, opts, callback)`
Downloads individual items from the Workshop.

- `ids` (array|string): Item ID(s).
- `path` (string): Destination path for downloaded items.
- `opts` (object): Options for downloading.
    - `do_zip` (boolean): If true, downloaded items will be zipped. Default is `false`.
    - `do_cleanup` (boolean): If true, temporary files will be removed after downloading. Default is `true`.
    - `steam_dir` (string): Directory for SteamCMD. Default is a temporary directory.
- `callback` (function): Callback function for tracking progress.