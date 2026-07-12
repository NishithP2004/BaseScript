# BaseScript

**A Baseline-Aware Scripting Language for Web Automation with Built-In Feature Compatibility Intelligence**

BaseScript is a modern browser automation framework that compiles YAML configurations into executable JavaScript code for Puppeteer, Playwright, and Selenium WebDriver. Beyond standard automation, BaseScript uniquely integrates **Baseline data** to analyze and verify web feature compatibility during automated browsing sessions.

![BaseScript Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)
![Backend](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)

![BaseScript Playground](/docs/img/playground_0.png)

## ✨ Features

- **🎯 Multi-Framework Support**: Write once, run on Puppeteer, Playwright, or Selenium
- **📝 YAML Configuration**: Human-readable automation scripts with plain English support
- **🔍 Baseline Intelligence**: Real-time CSS feature compatibility analysis and recommendations
- **🚨 Compatibility Alerts**: Dynamic DOM scanning for non-baseline CSS features
- **🖥️ Live Browser Preview**: Real-time VNC connection to see your automation
- **📸 Screenshot Gallery**: Capture and manage screenshots during automation
- **🔧 Code Compilation**: View compiled JavaScript output 
- **🎨 Modern Web Interface**: Dark/light theme with glassmorphism design
- **🐳 Docker Ready**: Complete containerized setup with Docker Compose and nginx reverse proxy
- **⚡ Redis Integration**: Fast caching and browser state management
- **📊 Feature Support Dashboard**: Visual feedback on CSS feature usage
- **💻 CLI Support**: Command-line interface for script execution and compilation

## 🧬 Baseline Integration

BaseScript's core innovation is its integration with **Baseline data** - a comprehensive database of web platform feature support across browsers. This enables:

### Real-Time Feature Analysis
- **DOM Scanning**: Automatically detects usage of CSS features in stylesheets and computed styles
- **Compatibility Scoring**: Evaluates CSS feature support based on baseline thresholds
- **Visual Feedback**: Highlights potential CSS compatibility issues during automation
- **Actionable Recommendations**: Provides specific guidance for addressing CSS compatibility gaps

### Baseline-Aware Actions
```yaml
- baseline_scan:
    availability: ["high", "low"]  # Baseline availability levels to check
    year: 2023                     # Baseline year threshold
    delay: "2s"                    # Wait time before scanning
```

## 🏗️ Architecture

BaseScript consists of five main components orchestrated through an nginx reverse proxy:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      nginx      │────│   Playground    │────│    Compiler     │────│     Browser     │
│ (Reverse Proxy) │    │  (React SPA)    │    │  (Express API)  │    │ (Chrome + VNC)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │                        │
         └────────────────────────┼────────────────────────┼────────────────────────┘
                                  │                        │
                         ┌─────────────────┐               │
                         │      Redis      │───────────────┘
                         │     (Cache)     │
                         └─────────────────┘
```

### Components

1. **nginx** - Reverse proxy handling routing and WebSocket connections
2. **Playground** - Web-based IDE for writing and testing automation scripts
3. **Compiler** - Parses YAML and compiles to framework-specific JavaScript
4. **Browser** - Containerized Chrome with VNC access for live previews
5. **Redis** - Handles browser state and WebSocket URL management

### Routing Architecture

The nginx reverse proxy handles:
- **`/`** → Playground frontend (React SPA)
- **`/api/*`** → Compiler backend (Express API)
- **`/vnc/*`** → Browser VNC interface

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

3. Access the application:
- **Web Interface**: http://localhost (nginx proxy)
- **VNC Browser**: http://localhost/vnc
- **Direct API**: http://localhost/api
- **Direct Chrome DevTools**: http://localhost:9222
- **Caddy Proxy to Chrome**: http://localhost:8080
- **Direct VNC**: http://localhost:7900
- **Redis**: http://localhost:6379

### CLI Usage

BaseScript includes a command-line interface for compiling and executing scripts:

```bash
# Compile and execute a BaseScript file
node compiler/cli.js script.bs

# Compile only (don't execute)
node compiler/cli.js script.bs --compile-only

# Specify output file
node compiler/cli.js script.bs --output automation.js

# Verbose output
node compiler/cli.js script.bs --verbose

# Show help
node compiler/cli.js --help
```

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

BaseScript uses YAML configuration files to define browser automation workflows. For a complete reference of all available commands and their parameters, see [Commands Reference](docs/commands.md).

## 🎛️ Configuration Options

For detailed information about all configuration options, commands, and parameters, please refer to the [Commands Reference](docs/commands.md).

### Key Command Categories

- **🌐 Navigation**: `goto`, `newPage`, `emulate`
- **⏱ Waiting**: `wait`, `waitForSelector`
- **🖱 Interaction**: `click`, `type`, `press`, `focus`, `hover`, `scroll`
- **📸 Capture**: `screenshot`
- **✅ Testing**: `assert`
- **🔬 Baseline**: `baseline_scan`
- **🛠 Control**: `close`

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
| `scroll` | Scroll to a specific element or coordinates, or scroll by relative pixel amounts | All |
| `type` | Type text into element | All |
| `press` | Press keyboard key | All |
| `screenshot` | Capture screenshot | All |
| `wait` | Wait for timeout | All |
| `waitForSelector` | Wait for element | All |
| `assert` | Assert element properties | All |
| `emulate` | Emulate device | Puppeteer |
| `hover` | Hover over element | All |
| `focus` | Focus element | All |

## 🔧 API Endpoints

### Via nginx Reverse Proxy

All API requests should be made through the nginx proxy:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/` | Service status |
| `POST` | `/api/run` | Compile and execute script |
| `GET` | `/api/screenshots` | List available screenshots |
| `GET` | `/api/screenshots/:filename` | Download screenshot file |
| `DELETE` | `/api/screenshots/:filename` | Delete a screenshot |

### Example Usage

```bash
# Execute a script (via nginx proxy)
curl -X POST http://localhost/api/run \
  -H "Content-Type: text/plain" \
  -d @script.yaml

# List screenshots
curl http://localhost/api/screenshots

# Download screenshot
curl http://localhost/api/screenshots/screenshot.png --output screenshot.png
```

## 🐳 Docker Configuration

### Environment Variables

#### nginx
- Uses `./nginx/default.conf` for routing configuration

#### Playground
- `VITE_BACKEND_URL` - Backend API URL (default: `/api` via nginx proxy)

#### Compiler
- `PORT` - Server port (default: `3000`)
- `REDIS_HOST` - Redis hostname (default: `redis`)
- `REDIS_PORT` - Redis port (default: `6379`)

#### Browser
- `REDIS_HOST` - Redis hostname (default: `redis`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `ENABLE_RECORDING` - Enable screen recording (default: `false`)
- `RTMP_URL` - RTMP stream URL for recording

### nginx Configuration

The nginx reverse proxy is configured with:

```nginx
# Main application
location / {
    proxy_pass http://playground:80;
    # WebSocket support for Socket.IO
}

# API routes
location /api/ {
    proxy_pass http://compiler:3000/;
    rewrite /api/(.*) /$1 break;
    # WebSocket support for real-time features
}

# VNC access
location /vnc/ {
    proxy_pass http://browser:7900/;
    # WebSocket support for VNC
}
```

### Custom docker-compose.yml

```yaml
services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - "./nginx/default.conf:/etc/nginx/conf.d/default.conf"
    depends_on:
      - compiler
      - playground
      - browser

  playground:
    build: ./playground
    environment:
      - VITE_BACKEND_URL=/api

  compiler:
    build: ./compiler
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis

  browser:
    build: ./browser
    ports:
      - "9222:9222"
      - "7900:7900"
      - "4444:4444"
    environment:
      - REDIS_HOST=redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:

networks:
  bs-net:
    driver: bridge
```

## 🛠️ Development

### Project Structure

```
BaseScript/
├── nginx/              # nginx reverse proxy config
│   └── default.conf    # Routing configuration
├── playground/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Playground.jsx
│   │   │   └── ScreenshotsViewer.jsx
│   │   ├── config.js
│   │   └── examples.js
│   └── package.json
├── compiler/          # Node.js backend
│   ├── compiler.js    # Main compilation logic
│   ├── parser.js      # YAML parsing and validation
│   ├── server.js      # Express server
│   ├── cli.js         # Command-line interface
│   └── package.json
├── browser/           # Chrome container
│   ├── Dockerfile
│   ├── Caddyfile      # Reverse proxy config
│   └── monitor_chrome.sh
├── docs/              # Documentation
│   └── commands.md    # Complete command reference
└── docker-compose.yaml
```

### Adding New Actions

1. Update the schema in [`compiler/parser.js`](compiler/parser.js)
2. Add handler methods to framework classes in [`compiler/compiler.js`](compiler/compiler.js)
3. Update the [Commands Reference](docs/commands.md)
4. Test with example scripts

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation in [docs/commands.md](docs/commands.md) if adding new commands
6. Submit a pull request

## 📊 Monitoring & Debugging

### Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f nginx
docker-compose logs -f compiler
docker-compose logs -f browser
docker-compose logs -f playground
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

Access the browser directly via:
- **Via nginx proxy**: `http://localhost/vnc` (recommended)
- **Direct access**: `http://localhost:7900`
- Password: `secret`

### nginx Access Logs

```bash
# View nginx access logs
docker-compose logs nginx

# Follow nginx logs in real-time
docker-compose logs -f nginx
```

## 📚 Documentation

- **[Commands Reference](docs/commands.md)** - Complete guide to all BaseScript commands and parameters
- **[API Documentation](docs/api.md)** - REST API endpoints and usage
- **[Examples](examples/)** - Sample scripts and use cases
- **[Architecture Guide](docs/architecture.md)** - Detailed system architecture

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Issues**: Report bugs and feature requests on GitHub Issues
- **Discussions**: Join the community discussions
- **Documentation**: Check the [docs](docs/) folder for detailed guides
- **Commands**: See [Commands Reference](docs/commands.md) for complete syntax documentation

## 🔮 Roadmap

- [ ] HTML and JavaScript baseline feature support
- [ ] Visual script builder interface
- [ ] Enhanced baseline compatibility reporting
- [ ] Multi-browser support (Firefox, Safari, Edge)
- [ ] Performance monitoring and analytics
- [ ] Mobile automation support

---

**BaseScript** - Making web automation smarter with baseline-aware feature compatibility intelligence! 🚀

*Democratizing web automation while accelerating the safe adoption of modern web features through real-time compatibility insights.*

> 📖 **New to BaseScript?** Start with the [Commands Reference](docs/commands.md) to learn all available automation commands and their usage.