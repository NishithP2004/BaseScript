# BaseScript Playground

A modern web-based playground for BaseScript browser automation with live VNC preview, screenshot gallery, and real-time code compilation.

## Features

- 🎯 **Live Browser Preview**: Real-time VNC connection to see your automation in action
- 📝 **YAML Editor**: Syntax-highlighted editor with multiple themes
- 📸 **Screenshot Gallery**: View and download generated screenshots
- 🔧 **Code Compilation**: See the compiled code output after execution
- 🎨 **Modern UI**: Dark/light theme support with glassmorphism design
- ⚡ **Auto-zoom**: Automatically focuses on browser during script execution

## Environment Configuration

The playground uses environment variables for backend configuration:

### Backend URL

Set the `VITE_BACKEND_URL` environment variable to configure the backend API endpoint:

```bash
# Default value (if not set)
VITE_BACKEND_URL=http://localhost:3000

# Custom backend URL
VITE_BACKEND_URL=https://api.yourdomain.com
```

### Setting Environment Variables

#### Option 1: Environment File
Create a `.env` file in the project root:
```bash
VITE_BACKEND_URL=http://localhost:3000
```

#### Option 2: Command Line
```bash
VITE_BACKEND_URL=http://localhost:3000 npm run dev
```

#### Option 3: System Environment
Export the variable in your shell:
```bash
export VITE_BACKEND_URL=http://localhost:3000
npm run dev
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Endpoints

The playground expects the following backend endpoints:

- `POST /run` - Execute BaseScript code
- `GET /screenshots` - List available screenshots
- `GET /:filename` - Download specific screenshot

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
