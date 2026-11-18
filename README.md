# UptoZishu Developer Console

The **UptoZishu Developer Console** is where developers publish and manage their apps for the [UptoZishu store](https://uptozishu.zishuai.cloud), see analytics, read reviews and feedback, and buy promotion plans.

Live: <https://dev.uptozishu.zishuai.cloud>

## Features

| Area | What it does |
| --- | --- |
| Dashboard | Totals, shortcuts and a rotating plan banner for developers who have no active plan |
| My Apps and Upload | Create apps, edit them, and send updates for approval |
| Analytics | Views, downloads and ratings per app |
| Reviews | Read reviews and reply |
| Feedback | Feedback from store users about your apps. Mark reviewed, open the app, or delete it from your list |
| App Advertisement | Four plans: **Sponsored** ₹99, **Featured** ₹149, **Verified badge** ₹49, **Developer Pro** ₹299 per month |
| Notifications and Support | Messages from the team, tickets and replies |
| Profile and Settings | Public developer profile, verification status, data export and account deletion |

## Admin approval

Nothing reaches the store without a check by the UptoZishu team in the admin panel.

- New apps, updates to live apps and profile changes are reviewed and approved or rejected with a reason.
- A suspended account sees a suspension notice on every page except Notifications, Settings and Profile.

## Plans and payment

1. Open **App Advertisement** and pick a plan.
2. On the details screen choose the app, see what you get, choose the months and tap **Get plan**.
3. Pay the exact total by UPI, then fill your details, the UTR and the payment screenshot, and submit.
4. The team verifies everything. If it is correct, the plan is approved and goes live within 3 to 5 days after payment. If not, it is rejected and you see the reason.
5. When the plan ends, the placement or badge is removed automatically.

Developer Pro gives, for each paid month, one app in Sponsored for one month, one app in Featured for one month and a Verified badge for two months.

**Refunds:** only within 24 hours of a successful payment. After 24 hours there is no refund. Fake payment proof or a fraudulent refund claim leads to account suspension. See the [Terms](https://dev.uptozishu.zishuai.cloud/terms/).

The admin can switch the advertisement service off. The console then shows "Advertisement feature is not available yet." and keeps "Your requests" visible.

## Tech

- Static multi-page site (HTML, CSS and one shared `assets/console.js`), hosted on GitHub Pages
- Firebase Authentication (email and Google) and Realtime Database
- Images are uploaded from the browser to imgbb
- Service emails are sent by a Google Apps Script web app (`Code.gs`)

```
/                Dashboard
/apps/           My Apps
/upload/         Upload App
/analytics/      Analytics
/reviews/        Reviews
/feedback/       Feedback
/advertise/      App Advertisement
/notifications/  Notifications
/support/        Support
/profile/        Profile
/settings/       Settings
/privacy/  /terms/   Legal
```

Each page links `assets/console.css` and `assets/console.js` with a `?v=` cache-busting number. Change the number in every html file when you change those two files.

## Deploy

1. Publish the Firebase rules file first.
2. Deploy the new version of the Apps Script mailer if `Code.gs` changed.
3. Upload the console files to the repository. GitHub Pages serves them.

## Legal

- [Privacy Policy](https://dev.uptozishu.zishuai.cloud/privacy/)
- [Terms and Conditions](https://dev.uptozishu.zishuai.cloud/terms/)

© 2026 ZISHU TRON. All rights reserved.
