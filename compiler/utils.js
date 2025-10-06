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

async function sleep(delay) {
    let timeout = parseTimeout(delay)
    return new Promise((resolve) => setTimeout(resolve, timeout))
}

async function checkAssertion(context, options, framework = "puppeteer") {
    try {
        // Wait for selector if timeout is provided
        if (options.timeout) {
            const timeout = parseTimeout(options.timeout)
            if (framework === "puppeteer" || framework === "playwright") {
                await context.waitForSelector(options.selector, { timeout })
            } else if (framework === "selenium") {
                const { By, until } = await import('selenium-webdriver')
                await context.wait(until.elementLocated(By.css(options.selector)), timeout)
            }
        }

        // Extract element and text content
        let element = null, text = ''

        if (framework === "puppeteer" || framework === "playwright") {
            element = await context.$(options.selector)
            if (!element && options.exists !== false)
                throw new Error(`Element not found: ${options.selector}`)

            text = element
                ? framework === "puppeteer"
                    ? (await context.$eval(options.selector, el => el.textContent?.trim() || ''))
                    : (await context.textContent(options.selector))?.trim() || ''
                : ''
        } 
        else if (framework === "selenium") {
            const { By } = await import('selenium-webdriver')
            try {
                element = await context.findElement(By.css(options.selector))
                text = (await element.getText()).trim()
            } catch (e) {
                if (options.exists !== false)
                    throw new Error(`Element not found: ${options.selector}`)
            }
        }

        // Perform assertions
        let result = true
        let message = ''

        if (options.contains) {
            result = text.includes(options.contains)
            message = `Expected text to contain "${options.contains}", but got: "${text}"`
        } else if (options.equals) {
            result = text === options.equals
            message = `Expected text to equal "${options.equals}", but got: "${text}"`
        } else if (options.matches) {
            const regex = new RegExp(options.matches)
            result = regex.test(text)
            message = `Expected text to match pattern ${regex}, but got: "${text}"`
        } else if (options.hasOwnProperty('exists')) {
            result = options.exists ? !!element : !element
            message = `Expected element to ${options.exists ? 'exist' : 'not exist'}`
        } else if (options.visible !== undefined) {
            let isVisible = false
            if (framework === "puppeteer")
                isVisible = element ? await element.isIntersectingViewport() : false
            else if (framework === "playwright")
                isVisible = element ? await element.isVisible() : false
            else if (framework === "selenium")
                isVisible = element ? await element.isDisplayed() : false

            result = options.visible ? isVisible : !isVisible
            message = `Expected element to be ${options.visible ? 'visible' : 'hidden'}`
        }

        // Log and handle results
        if (!result) {
            console.error(`❌ Assertion failed: ${message}`)
            if (options.throwOnFail !== false)
                throw new Error(`Assertion failed: ${message}`)
        } else {
            console.log(`✅ Assertion passed: ${options.selector}`)
        }

        return result
    } catch (error) {
        console.error(`❌ Assertion error: ${error.message}`)
        if (options.throwOnFail !== false)
            throw error
        return false
    }
}


export {
    parseTimeout,
    sleep,
    checkAssertion
}