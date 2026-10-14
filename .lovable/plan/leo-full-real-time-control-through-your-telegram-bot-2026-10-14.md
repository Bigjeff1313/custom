# Leo: full real-time control through your Telegram bot

Leo is the same Telegram bot you already connected. This plan finishes its setup so it sends you every event the moment it happens, takes commands, and answers questions about your data.

## What you'll get

**Live events (sent to the bot automatically)**
- New signup waiting for approval (Approve / Reject buttons). This already works.
- Link payment submitted (Confirm and activate button). Already works.
- Deposit submitted (Confirm deposit button). Already works.
- New: a link is paid with balance, a user is approved or rejected on the website, a custom domain is added, an error or support report comes in.

**Commands (control the site from Telegram)**
- `/approve <email>`, `/reject <email>`
- `/confirm <payment id>`, `/confirmdeposit <id>`
- `/activate <code>`, `/disable <code>`, `/delete <code>`
- `/credit <email> <amount>` adds money to a user's balance, `/debit <email> <amount>` takes it off
- `/verifydomain <domain>`

**Read data**
- `/user <email>` shows status, balance, plan and links
- `/balance <email>`, `/link <code>` (with click count), `/users`, `/pending`, `/deposits`, `/stats`, `/links`, `/domains`

Only your admin chat can use these. Anyone else gets "Unauthorized".

## What I need from you
- Nothing new if the bot token and your admin chat ID are already saved (I'll check).
- Optional: other Telegram chat IDs that should also control the site.

## Technical details
- Extend `telegram-webhook` with the new commands. They use the service role and take arguments, and each is checked against `TELEGRAM_ADMIN_CHAT_ID`.
- Add a `secret_token` to `setWebhook` and check the `X-Telegram-Bot-Api-Secret-Token` header, so nobody can fake updates.
- Add the new event types to `telegram-notify`. Send them from the website actions, and from `payments-api` for balance payments.
- Register the webhook again, then test each command with curl against the deployed function.
