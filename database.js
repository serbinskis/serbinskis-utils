const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

/* Example
var db = new Database({
    filename: 'database.db',
    error_callback: console.log,
    delete_unused: true,
    reorder: true,
    tables: {
        'files': [
            { name: 'id', type: 'TEXT', },
            { name: 'filename', type: 'TEXT', },
            { old: 'filesize', name: 'size', type: 'INTEGER' },
            { name: 'collection', type: 'TEXT', default_value: '[]' },
            { name: 'ip_address', type: 'TEXT' },
            { name: 'locked', type: 'INTEGER', default_value: 0 },
            { old: 'date', name: 'creation_date', type: 'INTEGER', default_value: 0 },
            { name: 'access_date', type: 'INTEGER', default_value: Date.now() },
        ]
    },
});
*/

function Database(opts) {
    this.ready = false;
    this.filename = opts.filename;
    this.directory = path.dirname(this.filename);
    this.delete_unused = false || opts.delete_unused;
    this.reorder = false || opts.reorder;
    this.tables = opts.tables || {};
    this.error_callback = opts.error_callback || (() => {});
}


Database.prototype.close = async function () {
    return new Promise(resolve => {
        this.db.close((err) => {
            if (err) { this.error_callback('close', err); return resolve({ code: 500 }); }
            resolve({ code: 200 });
        });
    });
}


Database.prototype.open = async function () {
    return new Promise(async (resolve) => {
        if (!fs.existsSync(this.directory)) { fs.mkdirSync(this.directory, { recursive: true }); }

        this.db = new sqlite3.Database(this.filename, (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE), async (err) => {
            if (err) { this.error_callback('close', err); return resolve({ code: 500 }); }

            for (const table in this.tables) {
                await this.createTable(table, this.tables[table]);
                if (this.reorder) { await this.reorderFields(table, this.tables[table]); }
            }

            this.ready = true;
            resolve({ code: 200 });
        });
    });
}


Database.prototype.createTable = async function (table, fields) {
    return new Promise(async (resolve) => {
        var result = await this.tableExists(table);
        if (result.code != 200) { return resolve({ code: 500 }); }
        if (result.status) { return resolve(await this.addFields(table, fields, this.delete_unused)); }

        const fdefinitions = fields.map(field => `"${field.name}" ${field.type}`).join(', ');
        this.db.run(`CREATE TABLE "${table}" (${fdefinitions})`, (err) => {
            if (err) { this.error_callback('createTable', err); return resolve({ code: 500 }); }
            resolve({ code: 200 });
        });
    });
}


Database.prototype.deleteTable = async function (table) {
    return new Promise(async (resolve) => {
        var result = await this.tableExists(table);
        if (result.code != 200) { return resolve({ code: 500 }); }
        if (!result.status) { return resolve({ code: 404 }); }

        this.db.get(`DROP TABLE "${table}"`, async (err) => {
            if (err) { this.error_callback('deleteTable', err); return resolve({ code: 500 }); }
            resolve({ code: 200 });
        });
    });
}

Database.prototype.getTableInfo = async function (table) {
    return new Promise(resolve => {
        this.db.all(`PRAGMA table_info("${table}")`, async (err, table_fields) => {
            if (err) { this.error_callback('reorderFields', err); return resolve({ code: 500, info: false }); }
            return resolve({ code: 200, info: table_fields });
        });
    });
}


Database.prototype.renameTable = async function (old_table, new_table) {
    var result1 = (await this.tableExists(old_table));
    if (!result1.status) { return { code: ((result1.code == 200) ? 404 : 500), status: false }; }

    var result2 = (await this.tableExists(new_table));
    if ((result2.code != 200) || result2.status) { return { code: ((result1.code == 200) ? 409 : 500), status: false }; }

    return new Promise(resolve => {
        this.db.run(`ALTER TABLE "${old_table}" RENAME TO "${new_table}"`, (err) => {
            if (err) { this.error_callback('renameTable', err); return resolve({ code: 500, status: false }); }
            resolve({ code: 200, status: true });
        });
    });
}


Database.prototype.tableExists = async function (table) {
    return new Promise(resolve => {
        this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], async (err, db_table) => {
            if (err) { this.error_callback('tableExists', err); return resolve({ code: 500, status: false }); }
            resolve({ code: 200, status: db_table ? true : false });
        });
    });
}


Database.prototype.addField = async function (table, field, type, default_value) {
    var result = await new Promise(resolve => {
        this.db.run(`ALTER TABLE "${table}" ADD COLUMN "${field}" ${type}`, (err) => {
            if (err) { this.error_callback('addField', err); return resolve({ code: 500 }); }
            resolve({ code: 200 });
        });
    });

    if ((default_value == null) || result.code != 200) { return result; }

    return await new Promise(resolve => {
        this.db.run(`UPDATE "${table}" SET "${field}"=?`, default_value, (err) => {
            if (err) { this.error_callback('addField', err); return resolve({ code: 500 }); }
            resolve({ code: 200 });
        });
    });
};


Database.prototype.addFields = function (table, fields, delete_unused) {
    return new Promise(async (resolve) => {
        for (const field of fields) {
            if (!field.old) { continue; }
            var result = await this.renameField(table, field.old, field.name);
            if (result.code == 500) { resolve(result); }
        }

        this.db.all(`PRAGMA table_info("${table}")`, async (err, table_fields) => {
            if (err) { this.error_callback('addFields', err); return resolve({ code: 500 }); }

            const add_fields = fields.map(field => field.name);
            const db_fields = table_fields.map(field => field.name);

            const missing_fields = fields.filter(e => !db_fields.includes(e.name));
            const unused_fields = db_fields.filter(e => !add_fields.includes(e));

            if (missing_fields.length != 0) {
                for (const field of missing_fields) {
                    var result = await this.addField(table, field.name, field.type, field.default_value);
                    if (result.code != 200) { resolve(result); }
                }
            }

            if (delete_unused && (unused_fields.length != 0)) {
                for (const field of unused_fields) {
                    var result = await this.deleteField(table, field);
                    if (result.code != 200) { resolve(result); }
                }
            }

            resolve({ code: 200 });
        });
    });
};


Database.prototype.deleteField = async function (table, field) {
    return new Promise(resolve => {
        this.db.run(`ALTER TABLE "${table}" DROP COLUMN "${field}"`, (err) => {
            if (err) { this.error_callback('deleteField', err); return resolve({ code: 500 }); }
            resolve({ code: 200 });
        });
    });
};


Database.prototype.renameField = async function (table, old_field, new_field) {
    var result1 = (await this.fieldExists(table, old_field));
    if (!result1.status) { return { code: ((result1.code == 200) ? 404 : 500), status: false }; }

    var result2 = (await this.fieldExists(table, new_field));
    if ((result2.code != 200) || result2.status) { return { code: ((result1.code == 200) ? 409 : 500), status: false }; }

    return new Promise(resolve => {
        this.db.run(`ALTER TABLE "${table}" RENAME COLUMN "${old_field}" TO "${new_field}"`, (err) => {
            if (err) { this.error_callback('renameField', err); return resolve({ code: 500, status: false }); }
            resolve({ code: 200, status: true });
        });
    });
};


Database.prototype.reorderFields = async function (table, fields) {    
    return new Promise(resolve => {
        this.db.all(`PRAGMA table_info("${table}")`, async (err, table_fields) => {
            if (err) { this.error_callback('reorderFields', err); return resolve({ code: 500, status: false }); }
            var match = fields.every((e, i) => table_fields[i].name == e.name);
            var rand_id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

            var db_fields = fields.map(e => {
                const index = table_fields.findIndex(field => field.name == e.name);
                return index != -1 ? table_fields.splice(index, 1)[0] : null;
            }).concat(table_fields);

            if (match) { return resolve({ code: 200, status: false }); }
            await this.deleteTable(`temp_${rand_id}`);

            var result = await this.createTable(`temp_${rand_id}`, db_fields);
            if (result.code != 200) { return resolve(result); }

            result = await new Promise(resolve1 => {
                this.db.run(`INSERT INTO "temp_${rand_id}" SELECT ${db_fields.map(e => e.name).join(', ')} FROM "${table}"`, (err) => {
                    if (err) { this.error_callback('reorderFields', err); return resolve1({ code: 500 }); }
                    resolve1({ code: 200 });
                });
            });

            if (result.code != 200) { return resolve({ code: result.code, status: false }); }

            result = await this.deleteTable(table);
            if (result.code != 200) { return resolve({ code: result.code, status: false }); }

            result = await this.renameTable(`temp_${rand_id}`, table);
            if (result.code != 200) { return resolve({ code: result.code, status: false }); }

            return resolve({ code: 200, status: true });
        });
    });
};


Database.prototype.fieldExists = async function (table, field) {
    return new Promise(resolve => {
        this.db.all(`PRAGMA table_info("${table}")`, async (err, table_fields) => {
            if (err) { this.error_callback('fieldExists', err); return resolve({ code: 500, status: false }); }
            resolve({ code: 200, status: table_fields.some(e => e.name == field) });
        });
    });
};


Database.prototype.addValues = async function (table, ...args) {
    return new Promise(resolve => {
        this.db.run(`INSERT INTO "${table}" VALUES(${Array(args.length).fill('?').join(',')})`, args, (err) => {
            if (err) { this.error_callback('addValues', err); return resolve({ code: 500 }); }
            resolve({ code: 200 });
        });
    });
};


Database.prototype.setValue = async function (table, field, value, search_field, search_value) {
    var that = this;

    return new Promise(resolve => {
        this.db.run(`UPDATE "${table}" SET "${field}"=? WHERE "${search_field}"=?`, [value, search_value], function (err) {
            if (err) { that.error_callback('setValue', err); return resolve({ code: 500, status: false, changes: 0 }); }
            resolve({ code: 200, status: (this.changes > 0), changes: this.changes });
        });
    });
};


Database.prototype.valueExists = async function (table, field, value, equality) {
    return new Promise(resolve => {
        this.db.get(`SELECT "${field}" FROM "${table}" WHERE "${field}"${equality ? equality : '='}? LIMIT 1`, [value], (err, row) => {
            if (err) { this.error_callback('valueExists', err); return resolve({ code: 500, status: false }); }
            resolve({ code: 200, status: row ? true : false });
        });
    });
};


Database.prototype.getRow = async function (table, field, value, equality) {
    var result = await this.getRows(table, field, value, equality, 1);
    return { code: result.code, row: (result.rows?.[0]) || null };
};


Database.prototype.getRows = async function (table, field, value, equality, limit) {
    return new Promise(resolve => {
        this.db.all(`SELECT * FROM "${table}" WHERE "${field}"${equality ? equality : '='}?${limit >= 0 ? ` LIMIT ${limit}` : ''}`, [value], (err, rows) => {
            if (err) { this.error_callback('getRows', err); return resolve({ code: 500, rows: null }); }
            resolve({ code: 200, rows: rows ? rows : null });
        });
    });
};


Database.prototype.deleteRow = async function (table, field, value, equality) {
    return await this.deleteRows(table, field, value, equality, 1);
};


Database.prototype.deleteRows = async function (table, field, value, equality, limit) {
    var that = this;

    return new Promise(resolve => {
        this.db.run(`DELETE FROM "${table}" WHERE "${field}" = (SELECT "${field}" FROM "${table}" WHERE "${field}"${equality ? equality : '='}?${limit >= 0 ? ` LIMIT ${limit}` : ''})`, [value], function(err) {
            if (err) { that.error_callback('deleteRows', err); return resolve({ code: 500, status: false, changes: 0 }); }
            resolve({ code: 200, status: (this.changes > 0), changes: this.changes });
        });
    });
};


Database.prototype.moveRows = async function (from_table, to_table, field, value, equality, limit) {
    var that = this;

    var result = await new Promise(resolve => {
        this.db.run(`INSERT INTO "${to_table}" SELECT * FROM "${from_table}" WHERE "${field}"${equality ? equality : '='}?${limit >= 0 ? ` LIMIT ${limit}` : ''}`, [value], function(err) {
            if (err) { that.error_callback('moveRows', err); return resolve({ code: 500, status: false, changes: 0 }); }
            resolve({ code: 200, status: (this.changes > 0), changes: this.changes });
        });
    });

    if (result.code != 200) { return result; }
    return await this.deleteRows(from_table, field, value, equality, limit);
};


Database.prototype.runQuery = function (...args) {
    this.db.run(...args);
};


Database.prototype.getQuery = function (...args) {
    this.db.get(...args);
};


Database.prototype.allQuery = function (...args) {
    this.db.all(...args);
};


module.exports = Database;