import express from "express"
import "dotenv/config"
import { run } from "./compiler.js"
import fs from "node:fs"
import cors from "cors"
import { client as redis } from "./redis.js";

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.raw({ limit: "5mb", type: "text/plain" }))
app.use(express.static("screenshots"))
app.use(cors())

const PORT = process.env.PORT || 3000

if(!fs.existsSync("screenshots")) {
    fs.mkdirSync("screenshots")
}

app.listen(PORT, () => {
    console.log(`BaseScript Compiler listening on port: ${PORT}`)
})

app.get("/", (req, res) => {
    res.send({
        message: "Welcome to the BaseScript Compiler Service",
    })
})

app.get("/screenshots", (req, res) => {
    try {
        const files = fs.readdirSync("screenshots")
        res.send({
            files
        })
    } catch (err) {
        res.status(500).send({
            error: `Error listing files in "screenshots" directory: ${err.message}`
        })
    }
})

app.post("/run", async (req, res) => {
    try {
        let code = req.body.toString("utf-8");
        let wsUrl = (await redis.get("CHROME_CDP_URL")).replace("localhost:9222", "browser:8080")
        code = code.replace("ws://browser:9222", wsUrl)
        const compiled = run(code)
        res.status(201).send(compiled)
    } catch (err) {
        res.status(500).send({
            error: err.message,
        })
    }
})

