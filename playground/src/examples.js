export const examples = {
  basic: `framework: puppeteer
browser: 
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://example.com"
  - screenshot:
      path: "screenshots/screenshot.png"`,

  form: `framework: playwright
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://httpbin.org/forms/post"
  - type:
      selector: "input[name='custname']"
      text: "John Doe"
  - type:
      selector: "input[name='custtel']"
      text: "555-1234"
  - click:
      selector: "input[type='submit']"
  - screenshot:
      path: "screenshots/form_result.png"`,

  testing: `framework: selenium
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://github.com"
  - assert:
      selector: "h1"
      contains: "GitHub"
  - click:
      selector: "[data-target='qbsearch-input.inputButton']"
  - type:
      selector: "#query-builder-test"
      text: "basescript"
  - press:
      key: "Enter"
  - waitForSelector:
      selector: ".search-title"
  - screenshot:
      path: "screenshots/search_results.png"`,
};

export default examples;


