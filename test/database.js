const Database = require('../database.js');

var config = {
    MAX_INT32: (Math.pow(2, 31)-1),
    ID: 'e52a0f08c63e4d73ac5deffd4d4a41ae',

    database_tables: {
        'files': [
            { name: 'id', type: 'TEXT', },
            { name: 'folder_id', type: 'TEXT', },
            { name: 'filename', type: 'TEXT', },
            { name: 'content_type', type: 'TEXT' },
            { name: 'size', type: 'INTEGER' },
            { name: 'collection', type: 'TEXT' },
            { name: 'ip_address', type: 'TEXT' },
            { name: 'locked', type: 'INTEGER' },
            { name: 'creation_date', type: 'INTEGER' },
            { name: 'access_date', type: 'INTEGER' },
        ],
        'files_backup': [
            { name: 'id', type: 'TEXT', },
            { name: 'folder_id', type: 'TEXT', },
            { name: 'filename', type: 'TEXT', },
            { name: 'content_type', type: 'TEXT' },
            { name: 'size', type: 'INTEGER' },
            { name: 'collection', type: 'TEXT' },
            { name: 'ip_address', type: 'TEXT' },
            { name: 'locked', type: 'INTEGER' },
            { name: 'creation_date', type: 'INTEGER' },
            { name: 'access_date', type: 'INTEGER' },
        ],
        'folders': [
            { name: 'id', type: 'TEXT', },
            { name: 'filename', type: 'TEXT', },
            { name: 'size', type: 'INTEGER' },
            { name: 'file_count', type: 'INTEGER' },
            { name: 'ip_address', type: 'TEXT' },
            { name: 'locked', type: 'INTEGER' },
            { name: 'frozen', type: 'INTEGER' },
            { name: 'creation_date', type: 'INTEGER' },
            { name: 'access_date', type: 'INTEGER' },
        ],
        'users': [
            { name: 'ip_address', type: 'TEXT' },
            { name: 'folder_count', type: 'INTEGER' },
            { name: 'creation_date', type: 'INTEGER' },
            { name: 'access_date', type: 'INTEGER' },
        ]
    }
}

var db = new Database({
    filename: 'database.db',
    error_callback: (name, err) => { console.error(name, err.message); process.exit(1); },
    delete_unused: true,
    reorder: true,
    tables: config.database_tables,
});

(async () => {
    await db.open();
    console.log(`Opened database: "${db.filename}".`);

    if ((await db.getRow('files', 'id', config.ID)).row == null) {
        await db.addValues('files', config.ID, config.ID, config.ID, '', config.MAX_INT32, '', '127.0.0.1', 0, 1, Date.now());
    }

    var result = await db.moveRows('files', 'files_backup', 'id', config.ID, '=', 1);
    console.log(result);
})();