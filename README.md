# origraph

UX innovations for NoSQL thinking

## Setup

1. Install [Quarto](https://quarto.org/docs/get-started/)

2. Run:

```bash
git clone https://github.com/origraph/origraph.git
cd origraph
npm install

# TODO: make this to a setup script?
cd site
quarto add --no-prompt clearmatics/qreacto
```

## Website

The website is built in two chunks: `/app` is a Vite app, and `/site` is a Quarto website.

For a preview of the full, combined site (both `/app` and `/site`), `npm run preview`

To work on the app, `npm run dev-app`

To work on the site, `npm run dev-site`

The site itself imports the built library; if you change something like a component in the app, and want it reflected in the site, you'll need to run `npm run build-library`

## Library

For now, the library just exports some basic components, utilities, and styles that are used in the app, for use in the site.

In the future, especially when we have standalone views, etc., it might be worth breaking this apart into an npm-publishable library / libraries.

## TODO

(document other `package.json` scripts, esp. browser extension, storybook, and vitest)
