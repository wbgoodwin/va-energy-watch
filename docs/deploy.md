# Deploying to Cloudflare Pages

These steps need your own Cloudflare and GitHub accounts, so they're done by hand once. About 20 minutes.
Menu names in the Cloudflare dashboard change from time to time; if one doesn't match, search the dashboard for the
quoted name.

## 1. Put the domain on Cloudflare

- **Bought at Cloudflare Registrar:** it's already in your account. Skip to step 2.
- **Bought elsewhere (Namecheap, Porkbun, GoDaddy...):** in Cloudflare choose **Add a domain**, enter
  `virginiaenergywatch.org`, pick the **Free** plan, and copy the two nameservers it shows. At your registrar, replace the
  domain's nameservers with those two. Cloudflare emails you when it's active (minutes to a few hours).

## 2. Create the Pages project

1. **Workers & Pages → Create → Pages → Connect to Git.** Authorize GitHub and choose `wbgoodwin/va-energy-watch`.
2. Settings:
   - Production branch: `main`
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
3. **Save and Deploy.** The first build takes a minute or two and gives you a `*.pages.dev` address. Open it and check
   the map loads.

Every push to `main` now deploys, and every pull request gets its own preview link.

## 3. Connect the domain

1. In the Pages project: **Custom domains → Set up a custom domain** → `virginiaenergywatch.org`. Cloudflare adds the DNS
   record for you.
2. Repeat for `www.virginiaenergywatch.org`.
3. Optional, send `www` to the bare domain: **Rules → Redirect Rules → Create rule**, "Redirect from WWW to root" template.

HTTPS certificates are issued automatically, usually within 15 minutes.

## 4. Nightly rebuild hook

The nightly GitHub Action rebuilds the site so comment-deadline countdowns stay current. It needs a deploy hook:

1. Pages project → **Settings → Builds → Deploy hooks → Add deploy hook**. Name `nightly`, branch `main`. Copy the URL.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
   Name `CF_PAGES_DEPLOY_HOOK`, value: the URL. Treat it like a password.
3. GitHub repo → **Actions → Nightly rebuild → Run workflow** to test it. A new deployment should appear in Cloudflare.

GitHub turns off scheduled workflows in a repo with no commits for 60 days and emails you first. Any commit, or clicking
**Enable workflow**, turns it back on.

## 5. Check it

- `https://virginiaenergywatch.org/` shows the map.
- `https://virginiaenergywatch.org/api/health` returns `{"ok":true,...}` (the Pages Function is running).
- `https://virginiaenergywatch.org/cases/feed.xml` returns RSS.

## Optional, free

- **Web Analytics:** Pages project → **Metrics → Web Analytics → Enable**. Cookie-free visitor counts.
- **Uptime alert:** a free UptimeRobot check on the home page, emailing your personal address.
