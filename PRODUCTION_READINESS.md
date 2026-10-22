# Nooranis production readiness

The repository now contains a functional content/demo experience and server API boundaries. Before public launch:

- Replace `apps/web/data/store.json` with a managed database and encrypted document storage. Do not store CNIC, NICOP, passport, or live-location data in an unsecured JSON file.
- Configure Google OAuth, SMS/email OTP delivery, session cookies, rate limiting, CSRF protection, account recovery, and audit logging.
- Set map, flight, hotel, currency, and realtime tracking provider credentials from `.env.example`. The current flight/hotel prices, currency rates, map distances, and images are estimates/demo data until those providers are connected.
- Restrict tracking endpoints to authenticated users with explicit consent and role-based access. Define retention and deletion rules.
- Publish privacy policy, terms, identity-document notice, consent language, refund/cancellation policy, and accessibility statement.
- Confirm package prices, hotel availability, flight fares, visa guidance, emergency contacts, office details, and official company contact information.
- Use a production HTTPS reverse proxy, secure headers, backups, monitoring, dependency updates, and a separate production data store.
- Test all forms and links on mobile, desktop, and logged-out browsers before launch.
