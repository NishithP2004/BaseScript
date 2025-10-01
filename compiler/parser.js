import YAML from "yaml"
import z from "zod"
import { KnownDevices } from "puppeteer"

const stepsSchema = z.object({
    newPage: z.boolean().optional(),
    emulate: z.object({
        device: z.enum(Object.keys(KnownDevices))
    }).optional(),
    goto: z.object({
        url: z.string().url(),
        waitUntil: z.enum(["domcontentloaded", "networkidle0", "networkidle2", "load"]).default("load").optional()
    }).optional(),
    wait: z.object({
        timeout: z.string().regex(/(\d+)(ms|m|s)*/)
    }).optional(),
    waitForSelector: z.object({
        selector: z.string()
    }).optional(),
    screenshot: z.object({
        path: z.string(),
        fullPage: z.boolean().optional()
    }).optional(),
    type: z.object({
        selector: z.string(),
        text: z.string(),
        delay: z.string().default("0ms")
    }).optional(),
    click: z.object({
        selector: z.string().optional(),
        coords: z.object({
            x: z.number(),
            y: z.number()
        }).optional()
    }).refine(data => data.selector || data.coords, {
        message: "Either selector or coords must be provided"
    }).optional(),
    press: z.object({
        key: z.string()
    }).optional(),
    focus: z.object({
        selector: z.string()
    }).optional(),
    hover: z.object({
        selector: z.string()
    }).optional(),
    baseline_scan: z.object({
        availability: z.array(z.enum(["high", "low", "false"])),
        year: z.number()
    }).optional(),
    assert: z.object({
        selector: z.string(),
        exists: z.boolean().optional(),
        contains: z.string().optional(),
        timeout: z.string().regex(/(\d+)(ms|m|s)*/).optional()
    }).refine(data => data.exists || data.contains, {
        message: "Either 'exists' or 'contains' must be provided"
    }).optional(),
    close: z.boolean().optional()
})

const browserConfigSchema = z.discriminatedUnion("mode", [
    z.object({
        mode: z.literal("launch"),
        launch: z.object({
            executablePath: z.string().optional(),
            headless: z.boolean().default(false),
            viewport: z.object({
                width: z.number(),
                height: z.number()
            }).optional()
        })
    }),
    z.object({
        mode: z.literal("connect"),
        connect: z.object({
            wsUrl: z.string()
        })
    })
])

const schema = z.object({
    framework: z.enum(["puppeteer", "playwright", "selenium"]),
    browser: browserConfigSchema,
    steps: z.array(stepsSchema).optional()
})

function parse(code) {
    try {
        const doc = YAML.parse(code)
        return schema.parse(doc)
    } catch(err) {
        console.error(`Error parsing YAML document: ${err.message}`)
    }
}

const cmds = ["framework", "browser", "emulate", "newPage", "goto", "wait", "waitForSelector", "screenshot", "type", "click", "press", "focus", "hover", "baseline_scan", "assert", "close"]

function generateIR(doc) {
    const ast = []
    for(let key of Object.keys(doc)) {
        if(key === "steps") {
            for(let obj of doc["steps"]) {
                let k = Object.keys(obj)[0]

                ast.push({
                    cmd: k,
                    value: obj[k]
                })
            }
        } else {
            ast.push({
                cmd: key,
                value: doc[key]
            })
        }
    }

    const mode = ast.find(e => e.cmd === "browser")?.value.mode || "launch"

    ast.push({
        cmd: "EOF",
        value: { operation: (mode === "launch")? "close": "disconnect" }
    })

    return ast
}

export {
    parse,
    generateIR
}