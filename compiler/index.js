import { run } from "./compiler.js"
import fs from "node:fs"

const main = () => {
    const code = fs.readFileSync("sample-workflow.yaml", "utf-8")
    run(code)
}

main()