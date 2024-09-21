# timer.js

A Node.js utility for managing timers in JavaScript. It provides methods to start, stop, finish, and change timers, allowing for flexible timing operations.

## Features
- Flexible Timer Management: Start, stop, and modify timers with ease.
- Callback Execution: Execute a callback function after a specified delay.
- Auto-Generated IDs: Automatically generate unique identifiers for each timer, or specify your own.
- Immediate Execution: Optionally execute the callback immediately upon starting the timer.
- Changeable Intervals: Modify the timing interval of an existing timer without needing to restart it.

---

## API Documentation

### Methods:

#### `start(cb, gap, opts)`
Starts a timer.

- `cb`: The callback function to be executed when the timer finishes.
- `gap`: The duration (in milliseconds) before executing the callback.
- `opts`: Optional settings.
  - `id`: Unique identifier for the timer (auto-generated if not provided).
  - `immediate`: If true, executes the callback immediately.

#### `finish(id)`
Executes the callback for the timer with the specified ID.

- `id`: The ID of the timer.

#### `stop(id)`
Stops the timer associated with the specified ID.

- `id`: The ID of the timer.

#### `change(id, gap, opts)`
Changes the timing for an existing timer.

- `id`: The ID of the timer.
- `gap`: The new delay in milliseconds.
- `opts`: Additional options for the timer.