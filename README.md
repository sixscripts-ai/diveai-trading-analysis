# 🧠 DiveAI | Autonomous Trading Analyst

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge)](https://diveai-trading-analysis.vercel.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**DiveAI** is an intelligent trading journal that uses **LLM Agents** to analyze trading behavior, detect psychological pitfalls, and generate actionable strategy improvements.

---

### 📸 Dashboard
![DiveAI Dashboard](DiveAI_Dashboard.png)

### 🤖 How It Works
1.  **Ingestion:** Users upload CSV trading logs (NinjaTrader, MetaTrader, etc.).
2.  **Analysis:** The system normalizes data and feeds it into a specialized **Google Gemini AI Agent**.
3.  **Insight Generation:** The AI identifies patterns (e.g., "Revenge Trading on Mondays") and provides a "Brutally Honest" performance review.

### 🛠️ Tech Stack
- **AI Engine:** Google Gemini API (via AI Studio)
- **Core:** TypeScript, React, Node.js v20
- **Infrastructure:** Docker Containerization & Nginx Reverse Proxy
- **Resilience:** PostgreSQL with connection pooling and fallback modes.

---

### 🐳 Deployment
\`\`\`bash
# Build the container
docker-compose build

# Run the stack
docker-compose up -d
\`\`\`
