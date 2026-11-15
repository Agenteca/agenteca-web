import { defineMiddleware } from 'astro:middleware';
import { createI18n, parseLocale, pickLocale } from './lib/i18n';

/** Chooses the language of each visit and remembers an explicit choice (`?lang=`) in a cookie. */
export const onRequest = defineMiddleware(async (context, next) => {
  const query = context.url.searchParams.get('lang');
  const locale = pickLocale({
    query,
    cookie: context.cookies.get('lang')?.value,
    header: context.request.headers.get('accept-language'),
  });
  if (parseLocale(query)) {
    context.cookies.set('lang', locale, {
      path: '/',
      maxAge: 365 * 24 * 3600,
      sameSite: 'lax',
      httpOnly: true,
    });
  }
  context.locals.i18n = createI18n(locale);
  const response = await next();
  response.headers.set('content-language', locale);
  response.headers.append('vary', 'Accept-Language, Cookie');
  return response;
});
