#!/usr/bin/env node

import { parse, generateIR } from "./parser.js"
import { compile, spawnChildProcess } from "./compiler.js"
import fs from "node:fs"
import path from "node:path"

const showHelp = () => {
    console.log(`
BaseScript Compiler CLI

Usage: node cli.js <input.bs> [options]

Options:
  -o, --output <file>  Specify output JS file (default: output.js)
  -c, --compile-only   Compile only, don't execute
  -v, --verbose        Show detailed compilation info
  -h, --help           Show this help message
`)
}

const parseArgs = () => {
    const args = process.argv.slice(2)
    const parsed = {
        inputFile: null,
        outputFile: "output.js",
        compileOnly: false,
        verbose: false,
        help: false
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === "-h" || arg === "--help") parsed.help = true
        else if (arg === "-c" || arg === "--compile-only") parsed.compileOnly = true
        else if (arg === "-v" || arg === "--verbose") parsed.verbose = true
        else if (arg === "-o" || arg === "--output") parsed.outputFile = args[++i]
        else if (!parsed.inputFile && !arg.startsWith("-")) parsed.inputFile = arg
        else throw new Error(`Unknown option: ${arg}`)
    }
    return parsed
}

const main = async () => {
    try {
        const args = parseArgs()
        if (args.help) return showHelp()
        if (!args.inputFile) throw new Error("No input file specified")
        if (!args.inputFile.endsWith(".bs")) throw new Error("Input must have .bs extension")
        if (!fs.existsSync(args.inputFile)) throw new Error("File not found: " + args.inputFile)

        if (args.verbose) console.log(`Reading file: ${args.inputFile}`)
        const source = fs.readFileSync(args.inputFile, "utf-8")

        if (args.verbose) console.log("Parsing BaseScript...")
        const parsed = parse(source)

        if (args.verbose) console.log("Generating IR...")
        const ir = generateIR(parsed)

        if (args.verbose) {
            console.log("Intermediate Representation:")
            console.table(ir)
        }

        if (args.verbose) console.log("Compiling...")
        const compiled = compile(ir)

        if (args.verbose) {
            console.log("Compiled Code:")
            console.log(compiled)
        }

        fs.mkdirSync(path.dirname(args.outputFile), { recursive: true })
        fs.writeFileSync(args.outputFile, compiled)
        console.log(`Compiled → ${args.outputFile}`)

        if (!args.compileOnly) {
            if (args.verbose) console.log("Executing...")
            await spawnChildProcess("stdio")
        }
    } catch (e) {
        console.error("Error:", e.message)
        process.exit(1)
    }
}

main()