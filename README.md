# Pastebin-Lite

Pastebin-Lite is a minimal Pastebin-style web application that allows users to create text pastes and share them via a unique URL.  
Each paste can optionally expire after a given time (TTL) and/or after a limited number of views.

The project is built as part of a take-home assignment and focuses on correctness, robustness, and API behavior rather than UI styling.



## Features

- Create a paste containing arbitrary text
- Receive a shareable URL
- View pastes via API or browser
- Optional constraints per paste:
  - Time-based expiry (TTL)
  - View-count limits
- Deterministic time support for automated testing (`TEST_MODE=1`)
- Safe HTML rendering (no script execution)
- Persistent storage (no in-memory-only data)


## Tech Stack

- Node.js
- Express
- Redis (persistence)
- Basic server-rendered HTML for viewing pastes

 ## How to Run the App Locally

### Prerequisites

- Node.js (v18+ recommended)
- Redis (local installation or cloud Redis)



### 1. Clone the repository

```bash
git clone https://github.com/ElectrograMER/pastebin.git
cd pastebin-lite
npm start (for backend)

(for frontend)-> cd src -> cd frontend-> npx serve

# pastebin
