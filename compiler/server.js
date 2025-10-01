import express from "express"
import "dotenv/config"
import { run } from "./compiler.js"
import fs from "node:fs"
import cors from "cors"
import { client as redis } from "./redis.js";
import { Server } from "socket.io"
import http from "node:http"

if (!fs.existsSync("screenshots")) {
    fs.mkdirSync("screenshots")
}

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.raw({ limit: "5mb", type: "text/plain" }))
app.use(express.static("screenshots"))
app.use(cors())

const server = http.createServer(app)
const PORT = process.env.PORT || 3000

const io = new Server(server)

server.listen(PORT, () => {
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

app.delete("/screenshots/:filename", (req, res) => {
    try {
        const { filename } = req.params;
        const files = fs.readdirSync("screenshots")

        if (files.includes(filename)) {
            fs.unlinkSync(`screenshots/${filename}`)
            res.status(200).send({
                success: true
            })
        } else {
            res.status(404).send({
                error: "File not found",
                success: false
            })
        }
    } catch (err) {
        res.send(500).send({
            error: err.message,
            success: false
        })
    }
})

app.post("/run", async (req, res) => {
    try {
        let code = req.body.toString("utf-8");
        let wsUrl = (await redis.get("CHROME_CDP_URL")).replace("localhost:9222", "browser:8080")
        code = code.replace("ws://browser:9222", wsUrl)
        const compiled = await run(code, io)
        res.status(201).send(compiled)
    } catch (err) {
        res.status(500).send({
            error: err.message,
        })
    }
})

io.on("connection", client => {
    console.log(`Connected to ${client.id}`)

    client.join("output-stream")
})