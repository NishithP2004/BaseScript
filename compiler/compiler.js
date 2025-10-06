import {
    parse,
    generateIR
} from "./parser.js"
import fs from "node:fs"
import {
    spawn
} from "node:child_process"
import { parseTimeout } from "./utils.js";

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
        return `import { parseTimeout, sleep, checkAssertion } from "./utils.js";\nimport { baselineScanPipeline } from "./baseline.js";\n`
    }
}

// Puppeteer Handler
class PuppeteerHandler extends FrameworkHandler {
    constructor() {
        super('puppeteer')
    }

    handleFramework() {
        return `${this.getAdditionalCode()}\nimport puppeteer, { KnownDevices } from "puppeteer";\nlet page, browser;\n`
    }

    handleBrowser(value) {
        switch (value.mode) {
            case "launch":
                return `browser = await puppeteer.launch(${JSON.stringify(value.launch, null, 2)})\npage = await browser.newPage();\n`
            case "connect":
                return `browser = await puppeteer.connect({ "browserWSEndpoint": "${value.connect.wsUrl}", defaultViewport: null })\npage = await browser.newPage();\n`
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
        return `await checkAssertion(page, ${JSON.stringify(value, null, 2)}, "puppeteer")\n`
    }

    handleBaseline_scan(value) {
        return `await baselineScanPipeline(page, ${JSON.stringify({ includeAvailability: value.availability, baselineYearThreshold: value.year, includeNotBaseline: true, strictness: 'relaxed', delay: value.delay })}, 'puppeteer');\n`
    }

    handleEOF(value) {
        return ((value.operation === "close") ? `await browser.close()\n` : `await browser.disconnect()\n`)
    }

    handleScroll(value) {
        if (value.to) {
            if (value.to.selector) 
                return `await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (el) { 
        el.scrollIntoView({ behavior: "smooth", block: "center" }); 
    }
}, "${value.to.selector}");
`
            else
                return `await page.evaluate((coords) => {
    window.scrollTo(coords.x, coords.y);
}, ${JSON.stringify(value.to.coords)});
`
        } else {
            return `await page.evaluate((by) => {
    window.scrollBy(by.dx, by.dy);
}, ${JSON.stringify(value.by)});
`
        }
    }
}

// Playwright Handler
class PlaywrightHandler extends FrameworkHandler {
    constructor() {
        super('playwright')
    }

    handleFramework() {
        return `${this.getAdditionalCode()}\nimport { chromium } from 'playwright'\nlet page, browser, context;\n`
    }

    handleBrowser(value) {
        switch (value.mode) {
            case "launch":
                return `browser = await chromium.launch(${JSON.stringify(value.launch, null, 2)})\ncontext = await browser.newContext()\npage = await context.newPage();\n`
            case "connect":
                return `browser = await chromium.connectOverCDP("${value.connect.wsUrl}")\npage = await browser.newPage();\n`
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

    handleScan(value) {
        if(value.to) {
            if(value.to.selector) 
                return `await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (el) { 
        el.scrollIntoView({ behavior: "smooth", block: "center" }); 
    }
}, "${value.to.selector}");
`
            else
                return `await page.evaluate((coords) => {
    window.scrollTo(coords.x, coords.y);
}, ${JSON.stringify(value.to.coords)});
`
        } else {
            return `await page.evaluate((by) => {
    window.scrollBy(by.dx, by.dy);
}, ${JSON.stringify(value.by)});
`
        }
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
        return `await checkAssertion(page, ${JSON.stringify(value, null, 2)}, "playwright")\n`
    }

    handleBaseline_scan(value) {
        return `await baselineScanPipeline(page, ${JSON.stringify({ includeAvailability: value.availability, baselineYearThreshold: value.year, includeNotBaseline: true, strictness: 'relaxed', delay: value.delay })}, 'playwright');\n`
    }

    handleEOF(value) {
        return `await browser.close()\n`
    }

    handleScroll(value) {
        if (value.to) {
            if (value.to.selector) 
                return `await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (el) { 
        el.scrollIntoView({ behavior: "smooth", block: "center" }); 
    }
}, "${value.to.selector}");
`
            else
                return `await page.evaluate((coords) => {
    window.scrollTo(coords.x, coords.y);
}, ${JSON.stringify(value.to.coords)});
`
        } else {
            return `await page.evaluate((by) => {
    window.scrollBy(by.dx, by.dy);
}, ${JSON.stringify(value.by)});
`
        }
    }
}

// Selenium Handler  
class SeleniumHandler extends FrameworkHandler {
    constructor() {
        super('selenium')
    }

    handleFramework() {
        return `${this.getAdditionalCode()}\nimport fs from "node:fs";\nimport { Builder, By, until } from 'selenium-webdriver'\nlet driver;\n`
    }

    handleBrowser(value) {
        switch (value.mode) {
            case "launch":
                return `driver = await new Builder().forBrowser('chrome').build();\nawait driver.manage().window().maximize();\n`
            case "connect":
                return `driver = await new Builder().forBrowser("chrome").usingServer("${value.connect.wsUrl}").build()\nawait driver.manage().window().maximize()\n`
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
        return `await driver.takeScreenshot().then(data => fs.writeFileSync("${value.path}", data, 'base64'))\n`
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
        return `await driver.close()\n`
    }

    handleWait(value) {
        return `await sleep("${value.timeout}")\n`
    }

    handleAssert(value) {
        return `await checkAssertion(driver, ${JSON.stringify(value, null, 2)}, "selenium")\n`
    }

    handleBaseline_scan(value) {
        return `await baselineScanPipeline(driver, ${JSON.stringify({ includeAvailability: value.availability, baselineYearThreshold: value.year, includeNotBaseline: true, strictness: 'relaxed', delay: value.delay })}, 'selenium');\n`
    }

    handleEOF(value) {
        return `await driver.quit()\n`
    }

    handleScroll(value) {
        if (value.to) {
            if (value.to.selector) 
                return `await driver.executeScript(\`
    const el = document.querySelector('${value.to.selector}');
    if (el) { 
        el.scrollIntoView({ behavior: "smooth", block: "center" }); 
    }
\`);
`
            else
                return `await driver.executeScript(\`
    window.scrollTo(${value.to.coords.x}, ${value.to.coords.y});
\`);
`
        } else {
            return `await driver.executeScript(\`
    window.scrollBy(${value.by.dx}, ${value.by.dy});
\`);
`
        }
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
            code += `console.log("✅ Step ${line.cmd}")\n`
        }
    }

    return code
}

async function spawnChildProcess(mode="socket", io) {
    const ps = spawn("node", ["output.js"])
    return new Promise((resolve, reject) => {
        ps.stdout.on("data", chunk => {
            if(mode === "socket")
                io.to("output-stream").emit("output", Buffer.from(chunk).toString("utf-8"))
            else 
                console.log(Buffer.from(chunk).toString("utf-8"))
        })

        ps.stderr.on("data", chunk => {
            if(mode === "socket")
                io.to("output-stream").emit("output", Buffer.from(chunk).toString("utf-8"))
            else 
                console.error(Buffer.from(chunk).toString("utf-8"))
        })

        ps.on("close", code => {
            if(mode === "socket")
                io.to("output-stream").emit("output", `Child process exited with code: ${code}`)
            else 
                console.log(`Child process exited with code: ${code}`)
            resolve()
        })
    })
}

async function run(code, io) {
    try {
        const parsed = parse(code)

        const ir = generateIR(parsed)
        console.log("Intermediate Representation (IR): ")
        console.table(ir)

        const compiled = compile(ir)
        console.log("Compiler Output: ")
        console.log(compiled)

        fs.writeFileSync("output.js", compiled)

        await spawnChildProcess("socket", io) 
        
        return compiled
    } catch (err) {
        console.error(`Error running code: ${err.message}`)
        throw err
    }
}

export {
    compile,
    run,
    spawnChildProcess
}