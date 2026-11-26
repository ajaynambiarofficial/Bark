# Team Email: Gmail API setup

Team Email sends with the Gmail API over HTTPS. This works on Render Free, where outbound SMTP is blocked. Escalation notifications continue to use the separately configured SMTP transport.

## Google Cloud setup

1. In the Google Cloud project that owns the existing `GOOGLE_CLIENT_ID`, enable **Gmail API**.
2. Open the OAuth 2.0 web client that matches `GOOGLE_CLIENT_ID` and add this exact **Authorized redirect URI**:

   ```text
   https://<your-render-host>/api/team-emails/google/callback
   ```

   The host must match `APP_ORIGIN` exactly. For local development, add `http://localhost:5173/api/team-emails/google/callback` as a second URI.
3. Configure the OAuth consent screen for the organization. Add the Gmail send scope `https://www.googleapis.com/auth/gmail.send`. If the consent screen is in Testing, add the shared mailbox as a test user; refresh tokens for external testing apps can expire after seven days. For ongoing company use, publish/verify the OAuth app as required by the Workspace policy.

## Render environment

Set these variables on the Render web service and redeploy:

- `GOOGLE_CLIENT_ID`: existing OAuth web client ID.
- `GOOGLE_CLIENT_SECRET`: secret for that same OAuth web client.
- `MAIL_TOKEN_ENCRYPTION_KEY`: a random 32-byte key represented as 64 hexadecimal characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and store it only in Render secrets. Keep a secure backup; changing it makes the stored OAuth token unreadable and requires reconnecting Gmail.
- `EMAIL_FROM`: `barkissuetracker@gmail.com` (the shared mailbox).
- `APP_ORIGIN`: the public Render app URL, including `https://` and no trailing path.

The app database migration creates the mailbox connection record. After deployment, sign in as an administrator with clearance level 90 or higher, open **Team → Team Email**, select **Connect Gmail**, and approve the shared `barkissuetracker@gmail.com` account. The page reports the connected mailbox. OAuth state expires after ten minutes, and the refresh token is stored encrypted in PostgreSQL.

Do not put the refresh token in frontend code or commit any OAuth secret or encryption key. If the shared Google account or token key changes, disconnect and reconnect the mailbox from Team Email.
