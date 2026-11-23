# Payment workflow configuration

The React checkout, order status/confirmation, hosted card redirect, wallet transfer submission, and admin wallet-review/COD-collection screens are implemented in the sibling `frontend` application. The backend remains the source of truth for every payment and order status.

## Database deployment

The payment change is an additive migration. It adds order idempotency/payment-audit columns and a `payment_attempts` table; it does not delete or rewrite existing orders.

1. Back up the target database and confirm the application is pointed at the intended environment.
2. Deploy the code and set the environment variables below.
3. Run `php artisan migrate --force` once against that intended database.
4. Check `php artisan migrate:status` and exercise a sandbox checkout before enabling card payments.

Do not run `migrate:fresh`, `db:wipe`, or other destructive database commands on an existing store.

Tests use the `testing` environment and an in-memory SQLite database defined in `phpunit.xml`; the feature suite does not migrate the development or production database.

## Environment variables

Set these in the deployment secret manager or server environment, never in React or source control:

| Variable | Purpose |
| --- | --- |
| `PAYMOB_SECRET_KEY` | Server-side Paymob API authentication |
| `PAYMOB_PUBLIC_KEY` | Paymob unified checkout public key returned to the browser |
| `PAYMOB_HMAC` | Paymob dashboard HMAC key used to validate callbacks and sign merchant references |
| `PAYMOB_CARD_INTEGRATION_ID` | Paymob sandbox card integration ID; use the production ID only after sandbox verification |
| `FRONTEND_URL` | HTTPS frontend origin used for Paymob's return URL |
| `WALLET_RECIPIENT_NUMBER` | Store-owned mobile wallet destination; defaults to `01018674258` |

`PAYMOB_INTEGRATION_ID` remains a legacy fallback for the card integration only. The API does not use Paymob wallet integrations for the manual transfer workflow.

The store owner must confirm that `01018674258` is a valid recipient for each offered wallet (Vodafone Cash, Orange Cash, and Etisalat Cash) before displaying it to customers. Do not ask customers for wallet PINs, OTPs, or passwords.

## Paymob sandbox and webhook

1. Create/configure a Paymob Egypt sandbox account and card integration in the merchant dashboard.
2. Put the sandbox Secret Key, Public Key, HMAC Secret, and card Integration ID into the server environment.
3. Configure the integration notification/webhook URL as `https://<api-host>/api/paymob/webhook`. The URL must be publicly reachable over HTTPS.
4. Configure the dashboard HMAC key to match `PAYMOB_HMAC`; do not disable HMAC validation.
5. Ensure `APP_URL` is the public HTTPS API base URL, so Paymob can reach the webhook generated from `/api/paymob/webhook`. The public `/api/payment-methods` endpoint disables card checkout unless Paymob keys, the card integration ID, the frontend URL, and an HTTPS API URL are configured.
6. Use a sandbox card to verify successful, declined, and pending callbacks. The backend confirms a card order only after a valid signed callback that matches the locally issued merchant reference, card integration, EGP amount, and order state.
7. Configure the production credentials and webhook only after successful sandbox testing. Keep the frontend return page informational: refresh `GET /api/orders/{order}` and display the backend payment status; returning from Paymob is not proof of payment.

The backend intentionally returns an error when required Paymob configuration is missing. It never simulates a successful payment.

## API workflow for frontend integration

- Create an order with `POST /api/orders` using `payment_method` `cod`, `card`, `vodafone`, `orange`, or `etisalat`. The authenticated user's cart and database product prices determine its contents and total. Send a per-checkout `Idempotency-Key` to make client retries return the original order.
- COD orders remain `unpaid`; the customer response says cash will be collected on delivery. An admin first marks the order `delivered`, then records actual cash collection with `PATCH /api/admin/orders/{order}/cod-payment` and `{"collected": true}`.
- Wallet orders return payment instructions (wallet name, the store's fixed destination `01018674258`, EGP amount, and order reference) and remain `awaiting_payment_confirmation`. Submit the customer's own Egyptian wallet number (`wallet_sender_phone`, e.g. an Orange Cash number starting `012`) plus either a transaction reference or a JPG/JPEG/PNG/PDF receipt (maximum 5 MB) with `POST /api/orders/{order}/wallet-transfer`. The sender number is saved with the payment attempt and shown to admins for transaction reconciliation; it does not change the store recipient. An uploaded receipt is stored on Laravel's private `local` disk and is not publicly accessible.
- Wallet submissions appear in `GET /api/admin/wallet-transfers`. An authorized admin approves/rejects with `POST /api/admin/wallet-transfers/{attempt}/review` and `{"decision":"approved"}` or `{"decision":"rejected","reason":"..."}`. Approval records the reviewing admin and time, and only then marks the order paid. Admin receipt downloads use `GET /api/admin/wallet-transfers/{attempt}/receipt`.
- Card orders start a Paymob session with `POST /api/orders/{order}/pay` and `{"payment_method":"card"}`. Use the returned `payment_url`; do not collect or store card data in this application. Poll/refresh the authenticated order endpoint after return.
- `GET /api/orders/{order}` is customer-scoped and returns the current payment/order status. Do not treat the order-creation response, transfer proof upload, or provider redirect as a payment success.

Paid orders cannot be cancelled through the existing order-status endpoint because this project has no refund workflow; refund and cancellation handling must be completed before supporting cancellation of an already-paid order.

## Frontend

From the `frontend` directory, set `VITE_API_URL=http://127.0.0.1:8000` for local Laravel development, then run `npm run dev`. Laravel CORS allows the local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`. In production, configure the frontend origin in Laravel's `FRONTEND_URL`/CORS allowlist and use HTTPS.
