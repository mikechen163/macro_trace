# MacroTracker

A real-time global macro data dashboard with a glassmorphism UI. Track commodities, forex, indices, and bond yields — all in one view.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.x-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **12 Global Assets** — Gold, Silver, Crude Oil, USD Index, USD/JPY, USD/EUR, SPY, QQQ, 10Y/2Y/30Y Treasury Yields, VIX
- **Real-time Prices** — Fetched from Yahoo Finance API
- **Multi-period Charts** — 1D, 5D, 1M, 3M, 1Y historical trend lines
- **Category Filters** — Commodities, Forex, Indices, Bonds
- **Detail Modal** — Click any asset card to see price, change, high/low, open, and historical chart
- **Responsive Design** — Works on desktop and mobile

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd macro_trace

# Install dependencies
npm install
```

### Run

```bash
node back.js
```

Open your browser and navigate to **http://localhost:3002**

## Tech Stack

| Layer    | Technology              |
|----------|------------------------|
| Frontend | HTML, Tailwind CSS, Vanilla JS |
| Backend  | Node.js, Express.js    |
| Data     | Yahoo Finance API (v8) |
| Caching  | node-cache             |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Serves the frontend |
| `GET /api/quotes` | Returns current prices for all tracked assets |
| `GET /api/history/:symbol?range=1d` | Returns historical data for a given symbol and range (`1d`, `5d`, `1mo`, `3mo`, `1y`) |

## Project Structure

```
macro_trace/
├── back.js          # Express server + Yahoo Finance API proxy
├── index.html       # Single-page frontend application
├── package.json     # Node.js dependencies
└── README.md        # This file
```

## License

MIT
