export const examples = {
  quickStart: `framework: puppeteer
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://example.com"
      waitUntil: "domcontentloaded"
  - screenshot:
      path: "screenshots/quick-start.png"
      fullPage: true
  - close: true`,

  searchCapture: `framework: playwright
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://www.google.com"
  - type:
      selector: "textarea[name='q']"
      text: "BaseScript browser automation"
      delay: "35ms"
  - press:
      key: "Enter"
  - waitForSelector:
      selector: "#search"
  - screenshot:
      path: "screenshots/search-results.png"
      fullPage: true
  - close: true`,

  formAutomation: `framework: playwright
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://httpbin.org/forms/post"
  - focus:
      selector: "input[name='custname']"
  - type:
      selector: "input[name='custname']"
      text: "Ada Lovelace"
  - type:
      selector: "input[name='custemail']"
      text: "ada@example.com"
  - click:
      selector: "button[type='submit']"
  - screenshot:
      path: "screenshots/form-submitted.png"
  - close: true`,

  responsiveCheck: `framework: puppeteer
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - emulate:
      device: "iPhone X"
  - goto:
      url: "https://example.com"
  - assert:
      selector: "h1"
      visible: true
      throwOnFail: true
  - screenshot:
      path: "screenshots/mobile-view.png"
      fullPage: true
  - close: true`,

  interactionTour: `framework: puppeteer
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://example.com"
  - hover:
      selector: "a"
  - scroll:
      by:
        dx: 0
        dy: 500
  - wait:
      timeout: "750ms"
  - scroll:
      to:
        selector: "h1"
  - screenshot:
      path: "screenshots/interaction-tour.png"
  - close: true`,

  validationSuite: `framework: selenium
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:4444/wd/hub"
steps:
  - goto:
      url: "https://example.com"
  - assert:
      selector: "h1"
      contains: "Example Domain"
      visible: true
      timeout: "2s"
      throwOnFail: true
  - assert:
      selector: "a"
      exists: true
  - close: true`,

  baselineScan: `framework: playwright
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://example.com"
  - baseline_scan:
      availability: ["high", "low"]
      year: 2024
      delay: "250ms"
  - screenshot:
      path: "screenshots/baseline-report.png"
  - close: true`,

  multiPageFlow: `framework: playwright
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://example.com"
  - newPage: true
  - goto:
      url: "https://httpbin.org"
  - screenshot:
      path: "screenshots/second-page.png"
  - close: true`,
};

export const exampleCatalog = [
  { id: "quickStart", title: "Quick start", description: "Open a page and capture a full-page screenshot", icon: "rocket", color: "blue" },
  { id: "searchCapture", title: "Search & capture", description: "Search, wait for results, and save the page", icon: "search", color: "green" },
  { id: "formAutomation", title: "Form automation", description: "Focus, type, and submit a real form", icon: "form", color: "violet" },
  { id: "responsiveCheck", title: "Responsive check", description: "Emulate mobile and validate visible content", icon: "device", color: "yellow" },
  { id: "interactionTour", title: "Interaction tour", description: "Hover, scroll, wait, and capture", icon: "pointer", color: "cyan" },
  { id: "validationSuite", title: "Validation suite", description: "Run content and visibility assertions", icon: "check", color: "red" },
  { id: "baselineScan", title: "Baseline scan", description: "Check web feature compatibility", icon: "sparkles", color: "pink" },
  { id: "multiPageFlow", title: "Multi-page flow", description: "Open and automate a second page", icon: "pages", color: "blue" },
];

export default examples;
