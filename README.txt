UPTOZISHU SUPPORT MAILER - setup (5 minutes, free)

1. Open https://script.google.com while signed in to the Gmail account the mails
   should come from (e.g. support.stardustofficial@gmail.com).
2. New project -> delete the default code -> paste ALL of Code.gs -> Save.
3. Click Run once on the function doGet (or any) -> Review permissions -> Allow
   (needs: send email, connect to external service).
4. Deploy -> New deployment -> type: Web app
      Execute as: Me
      Who has access: Anyone
   -> Deploy -> copy the "Web app URL" (ends with /exec).
5. Paste that URL into MAIL_ENDPOINT:
      console_multi/assets/console.js   (const MAIL_ENDPOINT = '...')
      admin_site/assets/admin.js        (const MAIL_ENDPOINT = '...')
6. Publish the new Firebase rules (email of a ticket must equal login email).

Notes
- Gmail limit: about 100 emails/day (free Gmail). Plenty for support tickets.
- If you edit Code.gs later: Deploy -> Manage deployments -> Edit -> New version.
- Test: open GET on the /exec URL in a browser, it shows {"ok":true,...}.
