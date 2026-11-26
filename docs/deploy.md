# Deploying to Cloudflare

The site runs on **Cloudflare Workers with static assets**. `npm run build` writes the pages to `dist/`, and
`wrangler.jsonc` tells Cloudflare to serve that folder, running `worker/index.ts` only for `/api/*`.

These steps need your own Cloudflare and GitHub accounts, so they're done by hand once. Menu names in the Cloudflare
dashboard change from time to time; if one doesn't match, search the dashboard for the quoted name.

## 1. Connect the repo (done Nov 26, 2026)

**Workers & Pages → Create → Import a repository** → `wbgoodwin/va-energy-watch`, with:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

Every push to `main` builds and deploys. The Worker is named `va-energy-watch`, matching `wrangler.jsonc`; if you ever
rename one, rename the other.

## 2. Put the domain on Cloudflare

- **Bought at Cloudflare Registrar:** it's already in your account. Skip to step 3.
- **Bought elsewhere (Namecheap, Porkbun, GoDaddy...):** in Cloudflare choose **Add a domain**, enter
  `virginiaenergywatch.org`, pick the **Free** plan, and copy the two nameservers it shows. At your registrar, replace the
  domain's nameservers with those two. Cloudflare emails you when the domain is active (minutes to a few hours).

## 3. Attach the domain to the Worker

1. **Workers & Pages → va-energy-watch → Settings → Domains & Routes → Add → Custom domain**.
2. Enter `virginiaenergywatch.org` and add it. Cloudflare creates the DNS record and the HTTPS certificate.
3. Repeat for `www.virginiaenergywatch.org`.
4. Optional, send `www` to the bare domain: on the domain's page, **Rules → Redirect Rules → Create rule**, using the
   "Redirect from WWW to root" template.

If **Add** says a DNS record already exists for the name (registrars often park one), delete that `A` or `CNAME` record
under the domain's **DNS → Records**, then add the custom domain again.

## 4. Nightly redeploy

The nightly GitHub Action rebuilds the site each morning so comment-deadline countdowns stay current, then deploys it
with Wrangler. It needs two repo secrets:

1. **Account ID:** in Cloudflare, **Workers & Pages** overview, right-hand side, **Account ID** → copy.
2. **API token:** profile icon → **Profile → API Tokens → Create Token** → template **Edit Cloudflare Workers** →
   Account Resources: your account; Zone Resources: **All zones from an account** (or just `virginiaenergywatch.org`) →
   **Continue → Create Token** → copy it once (Cloudflare shows it only once).
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - `CLOUDFLARE_ACCOUNT_ID` = the account ID
   - `CLOUDFLARE_API_TOKEN` = the token. Treat it like a password.
4. GitHub repo → **Actions → Nightly rebuild → Run workflow** to test it. A new deployment should appear under the
   Worker's **Deployments** tab.

Until the secrets exist, the nightly job still runs its checks and skips the deploy with a notice.

GitHub turns off scheduled workflows in a repo with no commits for 60 days and emails you first. Any commit, or clicking
**Enable workflow**, turns it back on.

## 5. Check it

- `https://virginiaenergywatch.org/` shows the map.
- `https://virginiaenergywatch.org/api/health` returns `{"ok":true,"service":"va-energy-watch"}`.
- `https://virginiaenergywatch.org/cases/feed.xml` returns RSS.

## Optional, free

- **Turn off the workers.dev address** once the domain works, so search engines see one site: Worker → **Settings →
  Domains & Routes** → `workers.dev` → **Disable**. Pages already declare `virginiaenergywatch.org` as their canonical address.
- **Web Analytics:** domain → **Analytics & Logs → Web Analytics**, cookie-free visitor counts.
- **Uptime alert:** a free UptimeRobot check on the home page, emailing your personal address.
