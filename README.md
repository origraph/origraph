# OriGraph

UX experiences for NoSQL thinking

## Setup

1. Install [Quarto](https://quarto.org/docs/get-started/)

2. Run:

```bash
git clone https://github.com/origraph/origraph.git
cd origraph
npm install
```

## Website

The website is built in two chunks: `/app` is a Vite app, and `/site` is a Quarto website.

For a preview of the full, combined site (both `/app` and `/site`), `npm run preview`

To work on the app, `npm dev-app`

To work on the site, `npm dev-site`

(TODO: document other `package.json` scripts, esp. browser extension, javascript library, storybook, and vitest)
