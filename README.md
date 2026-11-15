# Agenteca Web

Web site of the Agenteca catalog: search, filter by compatible tool, content of each package readable before installation, "copy the installation command" button.

> Status: 0.1.0; the Docker image is not published yet. Public catalogs only: no sign-in or administration page in this version (publishing goes through the API or `curl`).

Every page is rendered on the server (Astro): the site works without JavaScript, which only adds the copy button.

## Getting started

The site reads the API of `agenteca-server`, whose address is given by `AGENTECA_API_URL` (default: `http://localhost:8080`).

```bash
npm install
```

```bash
npm run build
```

```bash
AGENTECA_API_URL=http://localhost:8080 npm start
```

With Docker, see `compose.yaml` in `agenteca-server`.

## Languages

The site is available in English, French, Spanish, Chinese and Hindi. The language of a visit is, in order:

1. `?lang=<code>` in the address (`en`, `fr`, `es`, `zh`, `hi`), remembered for a year in a `lang` cookie;
2. that cookie;
3. the browser's `Accept-Language` header;
4. English.

Every page has a language menu in its footer and `hreflang` links for search engines. Sizes, dates and plurals follow the language (`Intl`).

Texts are written in English in the pages (`t('…')`, `plural(n, 'singular|plural')`) and translated in `src/locales/<code>.json`. `test/i18n.test.ts` fails when a text has no translation, when a translation is no longer used, or when its placeholders differ. Package descriptions come from their authors and are shown as written.

## Accessibility (WCAG 2.1 AA)

- Checked by the tests: axe-core rules on every page served (`test/pages.test.ts`), in French, Chinese and Hindi, and the contrast of both themes, light and dark (`test/contrast.test.ts`).
- Checked by hand: visual rendering of the catalog and package pages in a browser (dark theme).
- Not checked: a real screen reader, end-to-end keyboard navigation, 400 % zoom, the light theme by eye, the Hindi and Chinese pages by a native reader.

## Tests

```bash
npm test
```

The tests run the built site against a fake API.

## License

AGPL-3.0. Contributions under a contributor license agreement (CLA), see the `.github` repository of the organisation.
