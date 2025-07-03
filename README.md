# Dovela Personal Management (Community Edition)  
All‑in‑one **GTD task manager** + **Second‑Brain toolkit** for Obsidian

![License: GPL‑3.0‑or‑later](https://img.shields.io/badge/License-GPLv3-blue.svg)
![Min Obsidian v1.6.0](https://img.shields.io/badge/Obsidian-≥1.6-purple)

> **ES/EN** – La guía principal está en inglés para facilitar la publicación internacional.  
> Una sección rápida en español se incluye más abajo.

---

## ✨ Key features

| Area | What you get |
|------|--------------|
| **Capture & Clarify** | Quick‑add commands, inbox note, mobile-friendly slash commands. |
| **Organise (GTD)** | Projects & areas dashboards, next‑action queues, waiting‑for tracker. |
| **Review** | Weekly / monthly review panels with interactive checklists. |
| **Engage** | “Today” board (time‑block widgets), focus timer, Kanban swim‑lanes. |
| **Second‑Brain queries** | 🔍 Smart Dataview blocks pre‑built for PARA & Zettelkasten workflows. |
| **Visual widgets** | Task heat‑map, streak chart, progress bars for each project. |

---

## ⚖️ Community Edition vs Pro

|          | Community (GPL‑3.0+) | Pro (Commercial) |
|----------|----------------------|------------------|
| Core GTD engine | ✔️ Full | ✔️ |
| Custom Dataview blocks | ✔️ | ✔️ |
| AI helpers (OpenAI / Groq) | — | ✔️ |
| Advanced automations (Zapier / Make) | — | ✔️ |
| Priority updates & e‑mail support | Bug‑fixes only | 12 months included |
| Price | Free | 20‑60 USD / user (perpetual) |

See [`COMMERCIAL-LICENSE_EN.txt`](COMMERCIAL-LICENSE_EN.txt) for commercial terms.

---

## 🚀 Installation (Community Edition)

### 1 · Via Obsidian → Community Plugins  
1. In Obsidian, open **Settings → Community Plugins → Browse**.  
2. Search for **“Dovela Personal Management”**.  
3. Click **Install** and then **Enable**.

### 2 · Manual (latest pre‑release build)  
1. Download the ZIP from [GitHub releases](https://github.com/ajborbon/obsidian-dovela-personal-management/releases).  
2. Unzip into `.obsidian/plugins/obsidian-dovela-personal-management/`.  
3. Reload Obsidian and enable the plugin.

---

## 🛠️ Building from source

```bash
pnpm install           # install dev‑deps
pnpm dev -- --vault "/path/to/your/vault"   # hot‑reload into vault
pnpm build             # production build → dist/

Requires Node 20 LTS + pnpm 9.
All source code lives in src/ and is TypeScript‑first.

⸻

💎 Get the Pro edition

The Pro build unlocks AI helpers, N8N automations and priority support.
	1.	Visit https://www.crezco360.com/dovela.
	2.	Purchase a licence (20‑60 USD – perpetual, per user).
	3.	Download dovela-pro-main.js and replace the Community file.
	4.	Activate Settings → Dovela PM → Enter licence key.

Commercial terms: see COMMERCIAL-LICENSE.txt.

⸻

💖 Support the project
	•	⭐ Star this repo – it really helps!
	•	☕ Buy me a coffee
	•	❤️ Become a sponsor on GitHub Sponsors

⸻

🤝 Contributing

Pull requests are welcome!
All contributors must sign the Contributor Licence Agreement (CLA); the
bot will guide you on your first PR.

See CONTRIBUTING.md for linting, commit style and CLA link.

⸻

📜 Licensing
	•	Community Edition:
Released under GPL‑3.0‑or‑later – see LICENSE.
	•	Pro / commercial use:
Requires a paid licence – see COMMERCIAL-LICENSE.txt.

⸻

🗺️ Roadmap
	•	Mobile quick‑capture widget
	•	Calendar two‑way sync (ICS)
	•	Smart goal‑tracking (OKR mode)
	•	Team edition with shared boards

⸻

⚡ Sección rápida en español
	1.	Instalación:
	•	Ajustes → Community Plugins → Browse → busca “Dovela Personal Management”.
	2.	Edición Pro:
	•	Compra la licencia en https://www.crezco360.com/dovela y reemplaza el
archivo main.js. Introduce tu clave en la sección de ajustes del plugin.
	3.	Soporte:
	•	Escribe a AndresBorbon@crezco360.com (lun‑vie, 9‑17 h GMT‑5).

⸻

© 2025 Crezco 360 SAS – Dovela Personal Management
GTD® is a registered trademark of the David Allen Company and is used here for reference purposes only.

