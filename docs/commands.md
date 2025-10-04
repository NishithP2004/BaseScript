# 📖 BaseScript Commands Reference

BaseScript allows you to define browser automation scripts using a declarative YAML format.
Below is the full list of supported commands, their parameters, and usage examples.

---

## 🌐 Navigation Commands

### `goto`

Navigates to a URL.

**Parameters:**

* `url` *(string, required)* → Must be a valid URL.
* `waitUntil` *(enum: `domcontentloaded` | `networkidle0` | `networkidle2` | `load`)* → Event to wait for. Default: `load`.

**Example:**

```yaml
- goto:
    url: "https://example.com"
    waitUntil: "networkidle0"
```

---

### `newPage`

Opens a new browser page/tab.

**Parameters:**

* *(boolean, optional)* → `true` to open.

**Example:**

```yaml
- newPage: true
```

---

### `emulate`

Emulates a device viewport.

**Parameters:**

* `device` *(enum, required)* → Must be one of Puppeteer’s [Known Devices](https://pptr.dev/api/puppeteer.knowndevices).

**Example:**

```yaml
- emulate:
    device: "iPhone X"
```

---

## ⏱ Waiting & Synchronization

### `wait`

Waits for a fixed time.

**Parameters:**

* `timeout` *(string, required)* → Must match regex `(\d+)(ms|s|m)`.
  Examples: `500ms`, `2s`, `1m`.

**Example:**

```yaml
- wait:
    timeout: "3s"
```

---

### `waitForSelector`

Waits until a selector appears in the DOM.

**Parameters:**

* `selector` *(string, required)*.

**Example:**

```yaml
- waitForSelector:
    selector: "#login-button"
```

---

## 🖱 Interaction Commands

### `click`

Clicks an element by selector or coordinates.

**Parameters (at least one required):**

* `selector` *(string, optional)*.
* `coords` *(object, optional)* → `{ x: number, y: number }`.

**Example (selector):**

```yaml
- click:
    selector: "#submit"
```

**Example (coords):**

```yaml
- click:
    coords:
      x: 100
      y: 200
```

---

### `type`

Types text into an input field.

**Parameters:**

* `selector` *(string, required)*.
* `text` *(string, required)*.
* `delay` *(string, optional)* → Typing delay (default: `0ms`).

**Example:**

```yaml
- type:
    selector: "#username"
    text: "admin"
    delay: "50ms"
```

---

### `press`

Sends a keyboard key press.

**Parameters:**

* `key` *(string, required)* → Any valid keyboard key.

**Example:**

```yaml
- press:
    key: "Enter"
```

---

### `focus`

Focuses on an input element.

**Parameters:**

* `selector` *(string, required)*.

**Example:**

```yaml
- focus:
    selector: "#search"
```

---

### `hover`

Moves the mouse over an element.

**Parameters:**

* `selector` *(string, required)*.

**Example:**

```yaml
- hover:
    selector: ".menu-item"
```

---

### `scroll`

Scrolls to a position or element.

**Parameters (at least one of `to` or `by` required):**

* `to.selector` *(string, optional)*.
* `to.coords` *(object, optional)* → `{ x, y }`.
* `by.dx` / `by.dy` *(numbers, optional)* → Relative scroll.

**Example (to element):**

```yaml
- scroll:
    to:
      selector: "#footer"
```

**Example (relative):**

```yaml
- scroll:
    by:
      dx: 0
      dy: 500
```

---

### `screenshot`

Takes a screenshot.

**Parameters:**

* `path` *(string, required)* → File path to save.
* `fullPage` *(boolean, optional)*.

**Example:**

```yaml
- screenshot:
    path: "screenshots/screenshot.png"
    fullPage: true
```

---

## ✅ Assertions

### `assert`

Validates conditions on a selector.
At least **one assertion type** is required.

**Parameters:**

* `selector` *(string, required)*.
* Assertion types *(at least one required)*:

  * `exists: true|false`
  * `contains: string`
  * `equals: string`
  * `matches: regex`
  * `visible: true|false`
* `timeout` *(time string, optional)*.
* `throwOnFail` *(boolean, default: false)* → Whether to stop execution if assertion fails.

**Example:**

```yaml
- assert:
    selector: "#welcome"
    contains: "Hello"
    visible: true
    timeout: "2s"
    throwOnFail: true
```

---

## 🔬 Baseline Compatibility Scan

### `baseline_scan`

Checks feature availability across years.

**Parameters:**

* `availability` *(array, required)* → Values: `"high"`, `"low"`, `"false"`.
* `year` *(number, required)*.
* `delay` *(time string, optional)*.

**Example:**

```yaml
- baseline_scan:
    availability: ["high", "low"]
    year: 2023
    delay: "1s"
```

---

## 🛠 Browser Control

### `close`

Closes the current page or browser.

**Example:**

```yaml
- close: true
```

---

## 🌐 Browser Configuration (Top-level)

### `browser`

**Description**
Configures how BaseScript connects to or launches a browser instance. This is a **top-level command** and must be declared once at the start of the script.

**Modes**

* **`launch`** – Starts a new browser instance locally.
* **`connect`** – Connects to an already running browser instance via WebSocket.

**Parameters**

* **`mode`** *(required)*: Defines the connection mode. One of: `launch`, `connect`.
* **`launch`** *(object, required if `mode: launch`)*: Options for launching a local browser.

  * `executablePath` *(string, optional)*: Path to the browser executable.
  * `headless` *(boolean, optional, default: true)*: Run browser in headless mode.
  * `viewport` *(object, optional)*: Default page viewport.

    * `width` *(integer)*: Page width in pixels.
    * `height` *(integer)*: Page height in pixels.
* **`connect`** *(object, required if `mode: connect`)*: Options for connecting to an existing browser.

  * `wsUrl` *(string, required)*: The WebSocket endpoint for the DevTools Protocol.

**Examples**

* **Launch a browser locally**

  ```yaml
  browser:
    mode: launch
    launch:
      executablePath: "/path/to/chrome"
      headless: true
      viewport:
        width: 1280
        height: 720
  ```

* **Connect to an existing browser**

  ```yaml
  browser:
    mode: connect
    connect:
      wsUrl: "ws://localhost:9222/devtools/browser/..."
  ```

---

## 🧩 Framework Selection (Top-level)

### `framework`

Selects automation framework.

**Options:**

* `puppeteer`
* `playwright`
* `selenium`

**Example:**

```yaml
framework: puppeteer
```
---