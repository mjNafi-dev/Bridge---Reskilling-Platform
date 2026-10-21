# Bridge - Reskilling Platform

**Every skill starts from one you have.**

Bridge shows people which skill is worth learning next for the AI era, and how much of it they already know. Built for SDC Hackathon 2026, Domain 1 (Aiversecity Future-Ready Workforce).

> Work in progress. Full setup, architecture and Replit/RunPod details will be added as the build progresses.

## Run locally

Two parts: the Python API (matching + trend data) and the React app. Vite forwards `/api` to the API.

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

## Credits

- 3D icons (CV upload states) from [thiings.co](https://www.thiings.co). Free to use, no attribution required; credited here anyway.
- Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (Google Fonts), [Switzer](https://www.fontshare.com/fonts/switzer) (Fontshare).
- Book search: [Open Library](https://openlibrary.org/developers/api) API.

## License

Apache License 2.0. See [LICENSE](LICENSE).
