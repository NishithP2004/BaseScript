import {
    parse,
    generateIR
} from "./parser.js"
import fs from "node:fs"
import {
    execSync
} from "node:child_process"

function parseTimeout(delay) {
    const re = /(?<digit>\d+)(?<unit>ms|s|m)*/;
    let m = delay.match(re)
    let d = parseInt(m.groups.digit)
    let unit = m.groups.unit
    let timeout = d;
    switch (unit) {
        case "s":
            timeout *= 1000;
            break;
        case "m":
            timeout *= 60 * 1000;
            break;
        case "ms":
        default:
            break;
    }
    return timeout
}

// Base handler class
class FrameworkHandler {
    constructor(frameworkName) {
        this.frameworkName = frameworkName
    }

    handle(cmd, value) {
        const methodName = `handle${cmd.charAt(0).toUpperCase() + cmd.slice(1)}`
        if (typeof this[methodName] === 'function') {
            return this[methodName](value)
        }
        return null
    }

    getAdditionalCode() {
        return `
function parseTimeout(delay) {
    const re = /(?<digit>\\d+)(?<unit>ms|s|m)*/;
    let m = delay.match(re)
    let d = parseInt(m.groups.digit)
    let unit = m.groups.unit
    let timeout = d;
    switch(unit) {
        case "s": timeout *= 1000; break;
        case "m": timeout *= 60 * 1000; break;
        case "ms":
        default: break;
    }
    return timeout
}

async function sleep(delay) {
    let timeout = parseTimeout(delay)
    return new Promise((resolve) => setTimeout(resolve, timeout))
}
`
    }
}

// Puppeteer Handler
class PuppeteerHandler extends FrameworkHandler {
    constructor() {
        super('puppeteer')
    }

    handleFramework() {
        return `import puppeteer, { KnownDevices } from "puppeteer"\nlet page, browser;\n${this.getAdditionalCode()}\n${this.getAssertionCode()}\n`
    }

    handleBrowser(value) {
        switch (value.mode) {
            case "launch":
                return `browser = await puppeteer.launch(${JSON.stringify(value.launch, null, 2)})\npage = await browser.newPage();\n`
            case "connect":
                return `browser = await puppeteer.connect({ "browserWSEndpoint": "${value.connect.wsUrl}" })\npage = await browser.newPage();\n`
        }
    }

    handleEmulate(value) {
        return `await page.emulate(KnownDevices["${value.device}"])\n`
    }

    handleGoto(value) {
        return `await page.goto("${value.url}", { waitUntil: "${value.waitUntil}" })\n`
    }

    handleWaitForSelector(value) {
        return `await page.waitForSelector("${value.selector}")\n`
    }

    handleScreenshot(value) {
        return `await page.screenshot(${JSON.stringify(value, null, 2)})\n`
    }

    handleType(value) {
        const delay = parseTimeout(value.delay)
        return `await page.type("${value.selector}", "${value.text}", { "delay": ${delay} })\n`
    }

    handleClick(value) {
        if (value.selector)
            return `await page.locator("${value.selector}").click()\n`
        else
            return `await page.mouse.click(${value.coords.x}, ${value.coords.y})\n`
    }

    handlePress(value) {
        return `await page.keyboard.press("${value.key}")\n`
    }

    handleFocus(value) {
        return `await page.focus("${value.selector}")\n`
    }

    handleHover(value) {
        return `await page.hover("${value.selector}")\n`
    }

    handleClose() {
        return `await page.close()\n`
    }

    handleWait(value) {
        return `await sleep("${value.timeout}")\n`
    }

    handleAssert(value) {
        return `await checkAssertion(page, ${JSON.stringify(value, null, 2)})\n`
    }

    handleEOF(value) {
        return ((value.operation === "close") ? `await browser.close()\n` : `await browser.disconnect()\n`)
    }

    getAssertionCode() {
        return `
async function checkAssertion(page, options) {
    if(options.timeout) 
        await page.waitForSelector(options.selector, { "timeout": parseTimeout(options.timeout) })
    
    const text = await page.$eval(options.selector, el => el.textContent)
    
    if(options.contains) {
        return text.includes(options.contains)
    } else {
        return (options.exists)? !!text: !text;   
    }
}
`
    }
}

// Playwright Handler
class PlaywrightHandler extends FrameworkHandler {
    constructor() {
        super('playwright')
    }

    handleFramework() {
        return `import { chromium, firefox, webkit } from 'playwright'\nlet page, browser, context;\n${this.getAdditionalCode()}\n${this.getAssertionCode()}\n`
    }

    handleBrowser(value) {
        switch (value.mode) {
            case "launch":
                return `browser = await chromium.launch(${JSON.stringify(value.launch, null, 2)})\ncontext = await browser.newContext()\npage = await context.newPage();\n`
            case "connect":
                return `browser = await chromium.connect({ "wsEndpoint": "${value.connect.wsUrl}" })\ncontext = await browser.newContext()\npage = await context.newPage();\n`
        }
    }

    handleEmulate(value) {
        return `// Note: Device emulation should be set during context creation in Playwright\n`
    }

    handleGoto(value) {
        return `await page.goto("${value.url}")\n`
    }

    handleWaitForSelector(value) {
        return `await page.waitForSelector("${value.selector}")\n`
    }

    handleScreenshot(value) {
        return `await page.screenshot(${JSON.stringify(value, null, 2)})\n`
    }

    handleType(value) {
        const delay = parseTimeout(value.delay)
        return `await page.fill("${value.selector}", "");\nawait page.type("${value.selector}", "${value.text}", { delay: ${delay} })\n`
    }

    handleClick(value) {
        if (value.selector)
            return `await page.click("${value.selector}")\n`
        else
            return `await page.mouse.click(${value.coords.x}, ${value.coords.y})\n`
    }

    handlePress(value) {
        return `await page.keyboard.press("${value.key}")\n`
    }

    handleFocus(value) {
        return `await page.focus("${value.selector}")\n`
    }

    handleHover(value) {
        return `await page.hover("${value.selector}")\n`
    }

    handleClose() {
        return `await page.close()\n`
    }

    handleWait(value) {
        return `await sleep("${value.timeout}")\n`
    }

    handleAssert(value) {
        return `await checkAssertion(page, ${JSON.stringify(value, null, 2)})\n`
    }

    handleEOF(value) {
        return ((value.operation === "close") ? `await browser.close()\n` : `await browser.disconnect()\n`)
    }

    getAssertionCode() {
        return `
async function checkAssertion(page, options) {
    if(options.timeout) 
        await page.waitForSelector(options.selector, { timeout: parseTimeout(options.timeout) })
    
    const text = await page.textContent(options.selector)
    
    if(options.contains) {
        return text.includes(options.contains)
    } else {
        return (options.exists)? !!text: !text;   
    }
}
`
    }
}

// Selenium Handler  
class SeleniumHandler extends FrameworkHandler {
    constructor() {
        super('selenium')
    }

    handleFramework() {
        return `import { Builder, By, until } from 'selenium-webdriver'\nlet driver;\n${this.getAdditionalCode()}\n${this.getAssertionCode()}\n`
    }

    handleBrowser(value) {
        switch (value.mode) {
            case "launch":
                return `driver = await new Builder().forBrowser('chrome').build();\n`
            case "connect":
                return `// Connect mode not directly supported in basic Selenium setup\n`
        }
    }

    handleEmulate(value) {
        return `// Device emulation requires specific Chrome options in Selenium\n`
    }

    handleGoto(value) {
        return `await driver.get("${value.url}")\n`
    }

    handleWaitForSelector(value) {
        return `await driver.wait(until.elementLocated(By.css("${value.selector}")), 10000)\n`
    }

    handleScreenshot(value) {
        return `await driver.takeScreenshot().then(data => require('fs').writeFileSync("${value.path}", data, 'base64'))\n`
    }

    handleType(value) {
        return `await driver.findElement(By.css("${value.selector}")).clear();\nawait driver.findElement(By.css("${value.selector}")).sendKeys("${value.text}")\n`
    }

    handleClick(value) {
        if (value.selector)
            return `await driver.findElement(By.css("${value.selector}")).click()\n`
        else
            return `await driver.actions().move({x: ${value.coords.x}, y: ${value.coords.y}}).click().perform()\n`
    }

    handlePress(value) {
        return `await driver.actions().sendKeys("${value.key}").perform()\n`
    }

    handleFocus(value) {
        return `await driver.findElement(By.css("${value.selector}")).click()\n`
    }

    handleHover(value) {
        return `await driver.actions().move({origin: driver.findElement(By.css("${value.selector}"))}).perform()\n`
    }

    handleClose() {
        return `await driver.quit()\n`
    }

    handleWait(value) {
        return `await sleep("${value.timeout}")\n`
    }

    handleAssert(value) {
        return `await checkAssertion(driver, ${JSON.stringify(value, null, 2)})\n`
    }

    handleEOF(value) {
        return ((value.operation === "close") ? `await driver.quit()\n` : `await driver.close()\n`)
    }

    getAssertionCode() {
        return `
async function checkAssertion(driver, options) {
    if(options.timeout) 
        await driver.wait(until.elementLocated(By.css(options.selector)), parseTimeout(options.timeout))
    
    const element = await driver.findElement(By.css(options.selector))
    const text = await element.getText()
    
    if(options.contains) {
        return text.includes(options.contains)
    } else {
        return (options.exists)? !!text: !text;   
    }
}
`
    }
}

const frameworkHandlers = {
    puppeteer: new PuppeteerHandler(),
    playwright: new PlaywrightHandler(),
    selenium: new SeleniumHandler()
}

let currentFramework = null;

function compile(ir) {
    let code = ""

    const frameworkLine = ir.find(line => line.cmd === "framework")
    if (frameworkLine) {
        currentFramework = frameworkLine.value
    }

    for (const line of ir) {
        const handler = frameworkHandlers[currentFramework]
        const generatedCode = handler.handle(line.cmd, line.value)
        if (generatedCode) {
            code += generatedCode
        }
    }

    return code
}

function run(code) {
    try {
        const parsed = parse(code)
        const ir = generateIR(parsed)

        console.log("Intermediate Representation (IR): ")
        console.table(ir)

        console.log("Compiler Output: ")
        const compiled = compile(ir)
        console.log(compiled)

        fs.writeFileSync("output.js", compiled)
        execSync("node output.js", {
            encoding: "utf-8"
        })
        
        return compiled
    } catch (err) {
        console.error(`Error running code: ${err.message}`)
        throw err
    }
}

export {
    compile,
    run
}