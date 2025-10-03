import {
    parse,
    generateIR
} from "./parser.js"
import fs from "node:fs"
import {
    execSync,
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
        return `import { parseTimeout, sleep } from "./utils.js";\nimport { baselineScanPipeline } from "./baseline.js";\n`
    }
}

// Puppeteer Handler
class PuppeteerHandler extends FrameworkHandler {
    constructor() {
        super('puppeteer')
    }

    handleFramework() {
        return `${this.getAdditionalCode()}\nimport puppeteer, { KnownDevices } from "puppeteer";\nlet page, browser;\n${this.getAssertionCode()}\n`
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

    getAssertionCode() {
        return `
async function checkAssertion(page, options) {
    try {
        // Handle timeout option
        if(options.timeout) {
            await page.waitForSelector(options.selector, { "timeout": parseTimeout(options.timeout) })
        }
        
        // Get element and text content
        const element = await page.$(options.selector)
        if (!element && options.exists !== false) {
            throw new Error(\`Element not found: \${options.selector}\`)
        }
        
        const text = element ? await page.$eval(options.selector, el => el.textContent?.trim() || '') : ''
        
        // Perform assertions based on type
        let result = true
        let message = ''
        
        if (options.contains) {
            result = text.includes(options.contains)
            message = \`Expected text to contain "\${options.contains}", but got: "\${text}"\`
        } else if (options.equals) {
            result = text === options.equals
            message = \`Expected text to equal "\${options.equals}", but got: "\${text}"\`
        } else if (options.matches) {
            const regex = new RegExp(options.matches)
            result = regex.test(text)
            message = \`Expected text to match pattern \${regex}, but got: "\${text}"\`
        } else if (options.hasOwnProperty('exists')) {
            result = options.exists ? !!element : !element
            message = \`Expected element to \${options.exists ? 'exist' : 'not exist'}\`
        } else if (options.visible !== undefined) {
            const isVisible = element ? await element.isIntersectingViewport() : false
            result = options.visible ? isVisible : !isVisible
            message = \`Expected element to be \${options.visible ? 'visible' : 'hidden'}\`
        }
        
        if (!result) {
            console.error(\`❌ Assertion failed: \${message}\`)
            if (options.throwOnFail !== false) {
                throw new Error(\`Assertion failed: \${message}\`)
            }
        } else {
            console.log(\`✅ Assertion passed: \${options.selector}\`)
        }
        
        return result
    } catch (error) {
        console.error(\`❌ Assertion error: \${error.message}\`)
        if (options.throwOnFail !== false) {
            throw error
        }
        return false
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
        return `${this.getAdditionalCode()}\nimport { chromium } from 'playwright'\nlet page, browser, context;\n${this.getAssertionCode()}\n`
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
        return `await checkAssertion(page, ${JSON.stringify(value, null, 2)})\n`
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

    getAssertionCode() {
        return `
async function checkAssertion(page, options) {
    try {
        // Handle timeout option
        if(options.timeout) {
            await page.waitForSelector(options.selector, { timeout: parseTimeout(options.timeout) })
        }
        
        // Get element and text content
        const element = await page.$(options.selector)
        if (!element && options.exists !== false) {
            throw new Error(\`Element not found: \${options.selector}\`)
        }
        
        const text = element ? (await page.textContent(options.selector))?.trim() || '' : ''
        
        // Perform assertions based on type
        let result = true
        let message = ''
        
        if (options.contains) {
            result = text.includes(options.contains)
            message = \`Expected text to contain "\${options.contains}", but got: "\${text}"\`
        } else if (options.equals) {
            result = text === options.equals
            message = \`Expected text to equal "\${options.equals}", but got: "\${text}"\`
        } else if (options.matches) {
            const regex = new RegExp(options.matches)
            result = regex.test(text)
            message = \`Expected text to match pattern \${regex}, but got: "\${text}"\`
        } else if (options.hasOwnProperty('exists')) {
            result = options.exists ? !!element : !element
            message = \`Expected element to \${options.exists ? 'exist' : 'not exist'}\`
        } else if (options.visible !== undefined) {
            const isVisible = element ? await element.isVisible() : false
            result = options.visible ? isVisible : !isVisible
            message = \`Expected element to be \${options.visible ? 'visible' : 'hidden'}\`
        }
        
        if (!result) {
            console.error(\`❌ Assertion failed: \${message}\`)
            if (options.throwOnFail !== false) {
                throw new Error(\`Assertion failed: \${message}\`)
            }
        } else {
            console.log(\`✅ Assertion passed: \${options.selector}\`)
        }
        
        return result
    } catch (error) {
        console.error(\`❌ Assertion error: \${error.message}\`)
        if (options.throwOnFail !== false) {
            throw error
        }
        return false
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
        return `${this.getAdditionalCode()}\nimport fs from "node:fs";\nimport { Builder, By, until } from 'selenium-webdriver'\nlet driver;\n${this.getAssertionCode()}\n`
    }

    handleBrowser(value) {
        switch (value.mode) {
            case "launch":
                return `driver = await new Builder().forBrowser('chrome').build();\n`
            case "connect":
                return `driver = await new Builder().forBrowser("chrome").usingServer("${value.connect.wsUrl}").build()\n`
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
        return `await checkAssertion(driver, ${JSON.stringify(value, null, 2)})\n`
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

    getAssertionCode() {
        return `
async function checkAssertion(driver, options) {
    try {
        // Handle timeout option
        if(options.timeout) {
            await driver.wait(until.elementLocated(By.css(options.selector)), parseTimeout(options.timeout))
        }
        
        // Get element and text content
        let element = null
        let text = ''
        
        try {
            element = await driver.findElement(By.css(options.selector))
            text = element ? (await element.getText()).trim() : ''
        } catch (e) {
            if (options.exists !== false) {
                throw new Error(\`Element not found: \${options.selector}\`)
            }
        }
        
        // Perform assertions based on type
        let result = true
        let message = ''
        
        if (options.contains) {
            result = text.includes(options.contains)
            message = \`Expected text to contain "\${options.contains}", but got: "\${text}"\`
        } else if (options.equals) {
            result = text === options.equals
            message = \`Expected text to equal "\${options.equals}", but got: "\${text}"\`
        } else if (options.matches) {
            const regex = new RegExp(options.matches)
            result = regex.test(text)
            message = \`Expected text to match pattern \${regex}, but got: "\${text}"\`
        } else if (options.hasOwnProperty('exists')) {
            result = options.exists ? !!element : !element
            message = \`Expected element to \${options.exists ? 'exist' : 'not exist'}\`
        } else if (options.visible !== undefined) {
            const isVisible = element ? await element.isDisplayed() : false
            result = options.visible ? isVisible : !isVisible
            message = \`Expected element to be \${options.visible ? 'visible' : 'hidden'}\`
        }
        
        if (!result) {
            console.error(\`❌ Assertion failed: \${message}\`)
            if (options.throwOnFail !== false) {
                throw new Error(\`Assertion failed: \${message}\`)
            }
        } else {
            console.log(\`✅ Assertion passed: \${options.selector}\`)
        }
        
        return result
    } catch (error) {
        console.error(\`❌ Assertion error: \${error.message}\`)
        if (options.throwOnFail !== false) {
            throw error
        }
        return false
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
            code += `console.log("✅ Step ${line.cmd}")\n`
        }
    }

    return code
}

async function spawnChildProcess(io) {
    const ps = spawn("node", ["output.js"])
    return new Promise((resolve, reject) => {
        ps.stdout.on("data", chunk => {
            io.to("output-stream").emit("output", Buffer.from(chunk).toString("utf-8"))
        })

        ps.stderr.on("data", chunk => {
            io.to("output-stream").emit("output", Buffer.from(chunk).toString("utf-8"))
        })

        ps.on("close", code => {
            io.to("output-stream").emit("output", `Child process exited with code: ${code}`)
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

        /* execSync("node output.js", {
            encoding: "utf-8"
        }) */

        await spawnChildProcess(io) 
        
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