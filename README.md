# BaseScript

A modern browser automation framework that compiles YAML configurations into executable JavaScript code for Puppeteer, Playwright, and Selenium WebDriver.

![BaseScript Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)
![Backend](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)

## ✨ Features

- **🎯 Multi-Framework Support**: Write once, run on Puppeteer, Playwright, or Selenium
- **📝 YAML Configuration**: Human-readable automation scripts
- **🖥️ Live Browser Preview**: Real-time VNC connection to see your automation
- **📸 Screenshot Gallery**: Capture and manage screenshots during automation
- **🔧 Code Compilation**: View compiled JavaScript output
- **🎨 Modern Web Interface**: Dark/light theme with glassmorphism design
- **🐳 Docker Ready**: Complete containerized setup with Docker Compose
- **⚡ Redis Integration**: Fast caching and browser state management

## 🏗️ Architecture

BaseScript consists of four main components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Playground    │────│    Compiler     │────│     Browser     │
│  (React SPA)    │    │  (Express API)  │    │  (Chrome + VNC) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                         ┌─────────────────┐
                         │      Redis      │
                         │     (Cache)     │
                         └─────────────────┘
```

### Components

1. **Playground** - Web-based IDE for writing and testing automation scripts
2. **Compiler** - Parses YAML and compiles to framework-specific JavaScript
3. **Browser** - Containerized Chrome with VNC access for live previews
4. **Redis** - Handles browser state and WebSocket URL management

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd BaseScript
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access the playground:
- **Web Interface**: http://localhost
- **API**: http://localhost:3000
- **VNC**: http://localhost:7900
- **Chrome DevTools**: http://localhost:8080

### Local Development

1. Install dependencies for each component:
```bash
# Compiler
cd compiler && npm install

# Playground  
cd playground && npm install
```

2. Start Redis:
```bash
docker run -d -p 6379:6379 redis
```

3. Start the browser container:
```bash
cd browser
docker build -t basescript-browser .
docker run -d -p 9222:9222 -p 7900:7900 basescript-browser
```

4. Start the compiler:
```bash
cd compiler
npm start
```

5. Start the playground:
```bash
cd playground
npm run dev
```

## 📝 Writing Automation Scripts

BaseScript uses YAML configuration files to define browser automation workflows:

### Basic Example

```yaml
framework: puppeteer
browser: 
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://example.com"
  - screenshot:
      path: "screenshots/screenshot.png"
      fullPage: true
  - close: true
```

### Form Automation

```yaml
framework: playwright
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://httpbin.org/forms/post"
  - type:
      selector: "input[name='custname']"
      text: "John Doe"
  - type:
      selector: "input[name='custtel']"
      text: "555-1234"
  - click:
      selector: "input[type='submit']"
  - screenshot:
      path: "screenshots/form_result.png"
```

### Testing & Assertions

```yaml
framework: selenium
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://github.com"
  - assert:
      selector: "h1"
      contains: "GitHub"
  - click:
      selector: "[data-target='qbsearch-input.inputButton']"
  - type:
      selector: "#query-builder-test"
      text: "basescript"
  - press:
      key: "Enter"
  - waitForSelector:
      selector: ".search-title"
  - screenshot:
      path: "screenshots/search_results.png"
```

## 🎛️ Configuration Options

### Browser Modes

#### Launch Mode
```yaml
browser:
  mode: launch
  launch:
    headless: false
    viewport:
      width: 1920
      height: 1080
```

#### Connect Mode
```yaml
browser:
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
```

### Supported Actions

| Action | Description | Frameworks |
|--------|-------------|------------|
| `goto` | Navigate to URL | All |
| `click` | Click element or coordinates | All |
| `type` | Type text into element | All |
| `press` | Press keyboard key | All |
| `screenshot` | Capture screenshot | All |
| `wait` | Wait for timeout | All |
| `waitForSelector` | Wait for element | All |
| `assert` | Assert element properties | All |
| `emulate` | Emulate device | Puppeteer/Playwright |
| `hover` | Hover over element | All |
| `focus` | Focus element | All |

## 🔧 API Endpoints

### Compiler Service (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Service status |
| `POST` | `/run` | Compile and execute script |
| `GET` | `/screenshots` | List available screenshots |
| `GET` | `/:filename` | Download screenshot file |

### Example Usage

```bash
# Execute a script
curl -X POST http://localhost:3000/run \
  -H "Content-Type: text/plain" \
  -d @script.yaml

# List screenshots
curl http://localhost:3000/screenshots

# Download screenshot
curl http://localhost:3000/screenshot.png --output screenshot.png
```

## 🐳 Docker Configuration

### Environment Variables

#### Playground
- `VITE_BACKEND_URL` - Backend API URL (default: `http://localhost:3000`)

#### Compiler
- `PORT` - Server port (default: `3000`)
- `REDIS_HOST` - Redis hostname (default: `redis`)
- `REDIS_PORT` - Redis port (default: `6379`)

#### Browser
- `REDIS_HOST` - Redis hostname
- `REDIS_PORT` - Redis port
- `ENABLE_RECORDING` - Enable screen recording (default: `false`)
- `RTMP_URL` - RTMP stream URL for recording

### Custom docker-compose.yml

```yaml
services:
  playground:
    build: ./playground
    ports:
      - "80:80"
    environment:
      - VITE_BACKEND_URL=http://localhost:3000

  compiler:
    build: ./compiler
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379

  browser:
    build: ./browser
    ports:
      - "9222:9222"
      - "7900:7900"
    environment:
      - REDIS_HOST=redis
      - ENABLE_RECORDING=true

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

## 🛠️ Development

### Project Structure

```
BaseScript/
├── playground/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Playground.jsx
│   │   │   └── ScreenshotsViewer.jsx
│   │   ├── config.js
│   │   └── examples.js
│   └── package.json
├── compiler/           # Node.js backend
│   ├── compiler.js     # Main compilation logic
│   ├── parser.js       # YAML parsing and validation
│   ├── server.js       # Express server
│   └── package.json
├── browser/           # Chrome container
│   ├── Dockerfile
│   ├── Caddyfile      # Reverse proxy config
│   └── monitor_chrome.sh
└── docker-compose.yaml
```

### Adding New Actions

1. Update the schema in [`compiler/parser.js`](compiler/parser.js)
2. Add handler methods to framework classes in [`compiler/compiler.js`](compiler/compiler.js)
3. Test with example scripts

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📊 Monitoring & Debugging

### Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f compiler
docker-compose logs -f browser
```

### Redis Monitoring

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Monitor commands
MONITOR

# Check browser CDP URL
GET CHROME_CDP_URL
```

### VNC Access

Access the browser directly via VNC:
- URL: `http://localhost:7900`
- Password: `secret`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Issues**: Report bugs and feature requests on GitHub Issues
- **Discussions**: Join the community discussions
- **Documentation**: Check the [docs](docs/) folder for detailed guides

## 🔮 Roadmap

- [ ] Visual script builder
- [ ] Plugin system for custom actions
- [ ] Cloud deployment templates
- [ ] Performance monitoring
- [ ] Multi-browser support (Firefox, Safari)
- [ ] Parallel execution
- [ ] Test reporting and analytics

---

**BaseScript** - Making browser automation accessible to everyone! 🚀