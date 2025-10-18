# Baseline Autopilot

AI-assisted repository analysis and modernization toolkit.

Scan any codebase to report on languages, dependencies, features, security issues, and more, with actionable upgrade suggestions.

## Tech Stack

- Frontend: React (Vite)
- Backend: Node.js, Express
- Database: MongoDB
- UI: Tailwind CSS

## Getting Started

### Prerequisites

- Docker
- Node.js (v18+)

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-org/baseline-autopilot
   ```

2. Run the application using Docker Compose:
   ```sh
   docker-compose up --build
   ```

3. Access the application:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`

## Development

Run the frontend and backend services separately for development:

- Frontend:
  ```powershell
  cd frontend
  npm install
  npm run dev
  ```

- Backend:
  ```powershell
  cd backend
  npm install
  npm run dev
  ```

## Testing

- Frontend unit tests:
  ```powershell
  cd frontend
  npm test
  ```

- Backend tests:
  ```powershell
  cd backend
  npm test
  ```

## Features

- AI-powered insights and suggestions (`frontend/src/components/scan-details/AiSuggestions.jsx`).
- Detector coverage: Nx, Next.js, SvelteKit, Nuxt, Vue, Python, Java, Go (Gin, GORM), and ML (TensorFlow, PyTorch).
- Evaluation gate controls detector activation via `resources/tech-evaluation.json`.
- Real-time scan progress via WebSockets; exportable Markdown reports and unified diffs.