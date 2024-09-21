
# Database.js

A Node.js utility class for managing SQLite databases, supporting dynamic schema updates, table reordering, field management, and efficient data manipulation.

## Features
- Create and manage SQLite databases with automatic table creation and schema updates.
- Support for renaming tables and fields.
- Add, update, and delete fields dynamically.
- Optionally delete unused fields.
- Reorder table fields for better consistency.
- Insert, update, retrieve, and delete data from tables.
- Error handling through custom callbacks.


## Usage

### Initialize the Database

```js
const db = new Database({
    filename: 'database.db',
    error_callback: console.error,
    delete_unused: true,
    reorder: true,
    tables: {
        'files': [
            { name: 'id', type: 'TEXT' },
            { name: 'filename', type: 'TEXT' },
            { name: 'size', type: 'INTEGER' },
            { name: 'collection', type: 'TEXT', default_value: '[]' },
            { name: 'ip_address', type: 'TEXT' },
            { name: 'locked', type: 'INTEGER', default_value: 0 },
            { name: 'creation_date', type: 'INTEGER', default_value: Date.now() },
            { name: 'access_date', type: 'INTEGER', default_value: Date.now() },
        ]
    },
});

await db.open();
```

---

## API Documentation

### Constructor: `new Database(opts)`

Initializes a new `Database` instance.

#### Parameters:
- `opts`: An object with the following properties:
  - `filename` (string): The SQLite database file path.
  - `error_callback` (function): A callback function for handling errors.
  - `delete_unused` (boolean): Whether to delete unused fields (default: `false`).
  - `reorder` (boolean): Whether to reorder fields in tables (default: `false`).
  - `tables` (object): Defines the tables and their fields to be managed.

---

### Methods:

#### `open()`
Opens the SQLite database and initializes tables based on the schema. Creates tables if they don't exist and reorders fields if specified.

#### `close()`
Closes the database connection.

#### `createTable(table, fields)`
Creates a table with the specified fields if it doesn't already exist.

- `table` (string): Name of the table.
- `fields` (array): Array of field objects (`name`, `type`, etc.).

#### `deleteTable(table)`
Deletes a specified table.

- `table` (string): Name of the table to delete.

#### `renameTable(old_table, new_table)`
Renames a table.

- `old_table` (string): Current name of the table.
- `new_table` (string): New name for the table.

#### `addField(table, field, type, default_value)`
Adds a new field (column) to an existing table.

- `table` (string): Name of the table.
- `field` (string): Name of the new field.
- `type` (string): Field data type.
- `default_value` (optional): Default value for the new field.

#### `addFields(table, fields, delete_unused)`
Adds multiple fields to a table and optionally deletes unused fields.

- `table` (string): Name of the table.
- `fields` (array): Array of field objects (`name`, `type`, etc.).
- `delete_unused` (boolean): If true, delete fields not present in the schema.

#### `deleteField(table, field)`
Deletes a specified field (column) from a table.

- `table` (string): Name of the table.
- `field` (string): Name of the field to delete.

#### `renameField(table, old_field, new_field)`
Renames an existing field in a table.

- `table` (string): Name of the table.
- `old_field` (string): Current name of the field.
- `new_field` (string): New name for the field.

#### `reorderFields(table, fields)`
Reorders fields in a table based on the schema provided.

- `table` (string): Name of the table.
- `fields` (array): Array of field objects (`name`, `type`, etc.).

#### `addValues(table, ...args)`
Inserts values into a table.

- `table` (string): Name of the table.
- `...args`: Values to insert into the table.

#### `setValue(table, field, value, search_field, search_value)`
Updates a value in a table based on a condition.

- `table` (string): Name of the table.
- `field` (string): Field to update.
- `value` (any): New value to set.
- `search_field` (string): Field to search for a matching value.
- `search_value` (any): Value to search for.

#### `valueExists(table, field, value, equality)`
Checks if a value exists in a table.

- `table` (string): Name of the table.
- `field` (string): Field to check.
- `value` (any): Value to search for.
- `equality` (string): Optional comparison operator.

#### `getRow(table, field, value, equality)`
Fetches a single row from the table based on a condition.

- `table` (string): Name of the table.
- `field` (string): Field to match.
- `value` (any): Value to search for.
- `equality` (string): Optional comparison operator.

#### `getRows(table, field, value, equality, limit)`
Fetches multiple rows from the table based on a condition.

- `table` (string): Name of the table.
- `field` (string): Field to match.
- `value` (any): Value to search for.
- `equality` (string): Optional comparison operator.
- `limit` (number): Maximum number of rows to return.

#### `deleteRow(table, field, value, equality)`
Deletes a single row from the table based on a condition.

- `table` (string): Name of the table.
- `field` (string): Field to match.
- `value` (any): Value to search for.
- `equality` (string): Optional comparison operator.

#### `deleteRows(table, field, value, equality, limit)`
Deletes multiple rows from the table based on a condition.

- `table` (string): Name of the table.
- `field` (string): Field to match.
- `value` (any): Value to search for.
- `equality` (string): Optional comparison operator.
- `limit` (number): Maximum number of rows to delete.

#### `moveRows(from_table, to_table, field, value, equality, limit)`
Moves rows from one table to another based on a condition.

- `from_table` (string): Source table name.
- `to_table` (string): Destination table name.
- `field` (string): Field to match.
- `value` (any): Value to search for.
- `equality` (string): Optional comparison operator.
- `limit` (number): Maximum number of rows to move.

#### `runQuery(...args)`
Executes a raw SQL query using `db.run`.

#### `getQuery(...args)`
Executes a raw SQL query using `db.get`.

#### `allQuery(...args)`
Executes a raw SQL query using `db.all`.

---
