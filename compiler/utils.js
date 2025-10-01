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

export {
    parseTimeout,
    sleep
}