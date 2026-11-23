# Wasmer deployment and scaling checklist

The application code has API rate limits and additional query indexes, but those
changes alone do not demonstrate support for 500 concurrent users. The Wasmer
runtime, shared services, database limits, and a staging load test must also be
configured and verified.

## Required deployment configuration

- Run the application with `APP_ENV=production`, `APP_DEBUG=false`, a stable
  `APP_KEY`, and the public HTTPS `APP_URL`. Configure these as Wasmer secrets
  or environment variables; do not commit credentials or copy a local `.env`.
- Sanctum API tokens expire after 43,200 minutes (30 days) by default. Set
  `SANCTUM_EXPIRATION` to a different number of minutes if the client session
  policy requires it; avoid disabling token expiry in production.
- Configure `DB_CONNECTION=mysql` and the managed MySQL host, database, user,
  password, TLS settings, and connection limits. The development database at
  `127.0.0.1` is not a remote production database. Use the database provider's
  connection pooling if its connection limit requires it.
- Use a shared cache service for every application instance. Set
  `CACHE_STORE=redis` and the managed Redis connection values so rate limits
  are consistent across instances. Confirm the deployed PHP runtime has the
  Redis client configured before selecting it.
- If sessions are needed, use a shared session store rather than per-instance
  files. If a queue worker is enabled, use a shared queue and run workers as
  managed background processes; `QUEUE_CONNECTION=database` adds database
  traffic.
- Product images must use storage shared by all instances (for example,
  compatible object storage). Instance-local files may not survive restarts or
  be visible to other instances.
- Verify that Laravel receives the real client IP from the Wasmer proxy before
  relying on IP-based throttling. Do not trust forwarded IP headers from
  arbitrary clients or configure broad trusted-proxy ranges without confirming
  the platform's proxy behavior.
- Set `FRONTEND_URL` to the deployed HTTPS frontend URL. Set `APP_URL` to the
  publicly reachable HTTPS API URL so Paymob can reach the webhook at
  `/api/paymob/webhook`.
- Build the frontend with `VITE_API_URL` set to the public API origin (without
  the `/api` suffix); its local development fallback is `http://127.0.0.1:8000`.
- Configure Paymob's secret key, public key, HMAC secret, and the integration
  ID for each enabled method (`PAYMOB_CARD_INTEGRATION_ID`,
  `PAYMOB_VODAFONE_INTEGRATION_ID`, `PAYMOB_ORANGE_INTEGRATION_ID`, and
  `PAYMOB_ETISALAT_INTEGRATION_ID`) as Wasmer secrets/environment variables.
  The legacy `PAYMOB_INTEGRATION_ID` is accepted as a fallback for card only.
  The IDs must be created and enabled in the Paymob account; they are not
  supplied by this repository.
- Configure Paymob to send notifications to the deployed HTTPS webhook. Use
  hosted Paymob checkout for card and wallet details; the application must not
  collect or store card numbers, CVVs, or wallet PINs.

## Safe release and capacity verification

1. Deploy to staging with the same PHP extensions, MySQL, Redis, storage, and
   proxy setup intended for production.
2. Review `php artisan migrate:status` and the pending migration files before
   applying migrations. Back up the database first. Do not run migrations
   automatically on every application instance.
3. Exercise registration, login, catalog browsing, cash-on-delivery checkout,
   each configured Paymob hosted-checkout method, payment callbacks, and admin
   endpoints in staging. Confirm callback HMAC, currency, integration ID, order
   amount, and final order state using Paymob's test mode.
4. Run a controlled load test against staging, ramping to at least 500
   concurrent users. Monitor response latency, HTTP 429/5xx rates, PHP worker
   saturation, Redis health, MySQL connection count/slow queries, and queue
   depth. Do not load-test the local or production database without an approved
   test plan.
5. Tune Wasmer instance and worker capacity and the managed database limits
   from the measurements. A passing functional test is not a load-test result.
