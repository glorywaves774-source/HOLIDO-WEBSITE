# HOLIDO Website — Full-stack project

A responsive, server-rendered multipage website and SQLite-backed content management system for Holistic Development Organisation (HOLIDO). The NCRI-Ghana project supplied by the organisation is used as a functional roadmap only; NCRI branding, copy and organisational data are not imported.

## Public website

- Home, About, Programmes, Programme details, Projects, Impact stories, Our People, News & Updates, Partners, Gallery, Resources & Publications, Get Involved, Donate/Support, Contact and Privacy Notice.
- Responsive HOLIDO red-and-white brand system and supplied HOLIDO logo.
- Homepage hero uses a brightened crop from the homepage graphic approved in this project.
- Contact details: NK143 C, Tamale, Ghana; holidoghana@gmail.com; georgedam@holido.org; www.holido.org.
- Newsletter subscription capture (CSV export available to administrators).
- Contact enquiries stored for administrator review.
- Partner, gallery and resource sections remain ready for HOLIDO to populate later.
- Donation page deliberately directs visitors to verified contact channels. No unverified payment account or payment gateway is presented.

## Administrator / CMS

- Administrator login with bcrypt password hashing and server-side SQLite sessions.
- Dashboard and content management for programmes, projects, impact stories, people, news, partners, gallery items and resource summaries.
- Draft/publish state, display ordering, image URL or image upload.
- Separate document library for PDF, Word, Excel, PowerPoint and CSV uploads. Files are stored outside the public web root and served through a permission-checked download route.
- Contact enquiry inbox with read/new status.
- Newsletter subscriber export to CSV.
- Automatic daily backup checks plus manual backup creation and download. Backups include the SQLite database, uploaded images and private documents; the latest 14 archives are retained. Set `BACKUP_DIR` to a dedicated persistent disk or `BACKUP_DISABLE=1` to disable automatic backups.

## Security controls

- Helmet security headers and a restrictive Content Security Policy.
- CSRF tokens for state-changing forms.
- Rate limiting on administrator login, contact and subscription forms.
- HttpOnly, SameSite=Lax session cookies; Secure cookies in production.
- Password hashing with bcrypt.
- Upload file size limits and extension/MIME allowlists; SVG and executable uploads are not accepted.
- Private documents are not served from a public static directory.
- Admin routes require an authenticated session.
- Production startup refuses a missing/weak SESSION_SECRET.

## Requirements and setup

- Node.js 20 or newer
- npm

1. Copy `.env.example` to `.env`.
2. Keep `NODE_ENV=development` for local testing (production mode enforces HTTPS-only cookies). Set a unique `SESSION_SECRET` (at least 32 characters), `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (at least 14 characters).
3. Install dependencies: `npm install`.
4. Create/update the administrator: `npm run setup-admin`.
5. Start: `npm start`.
6. Public website: `http://localhost:3000`.
7. Admin area: `http://localhost:3000/admin/login`.

SQLite data is created in `data/holido.sqlite`. Uploaded images are in `uploads/`; private documents are in `private-documents/`; backups are in `backups/`.

## Backups

- Admin: sign in, open Backups and select Create backup now.
- CLI: `npm run backup`.
- Backups are `.tar.gz` archives containing the database, uploads, private documents and a manifest. Set `BACKUP_DIR` for a dedicated persistent disk. Download a copy to storage separate from the hosting server and test restoration on a separate copy before relying on it.

## Deployment notes

- Deploy to a Node.js host with persistent disk storage. SQLite and media need persistent volumes and off-server backups.
- Configure HTTPS, `NODE_ENV=production`, `SESSION_SECRET`, `SITE_URL`, admin credentials and secrets in the hosting provider's secret manager. Never commit `.env`.
- For multi-instance/high-traffic hosting, migrate to managed PostgreSQL and object storage.
- Configure SMTP through a vetted provider before relying on email notifications; contact enquiries currently persist in the admin inbox and are not assumed to be emailed.
- Online donations are not enabled until HOLIDO supplies and verifies its payment channels and authorises gateway integration.
- Review the privacy notice, accessibility, consent, legal and programme/impact copy before launch.

## Content accuracy

Use HOLIDO's source website as the content reference and the user-provided logo/contact details as authoritative. Do not publish unverified names, partner logos, programmes, statistics, photographs or payment instructions. The CMS is intended to let HOLIDO add approved programmes and photographs later.


## Source-site programme content and photographs

The programme page uses HOLIDO's published thematic areas: Agriculture & Food Security, Education, and Health. The page also includes a photo feature section populated with photographs linked from the existing https://holido.org website and captions reflecting the source site's impact stories and activities. The photographs are remotely hosted by the source website; before production launch, HOLIDO should confirm image-use permissions and preferably move approved originals into the website's managed media library. Adult Literacy, Savings with Education, Early Childhood Development, Food Security & Climate Resilience, and the UNDP / UN Peacebuilding Fund artisan-livelihoods work are represented as named activities/projects where published by HOLIDO. No unavailable photographs are fabricated or assigned to unrelated programme areas.

## Version 1.3.0 project update

Added the project **Ending Female Genital Mutilation in the Cross-Border Region of Ghana and Burkina Faso** to the Projects section, categorised under Health. The project is inserted idempotently during database initialisation, so it is included on fresh installations and added to existing databases without duplicating an existing slug. Unverified implementation details and photographs are intentionally left blank for HOLIDO to supply.

## Version 1.5.0 debugging release

Merges the v1.3.0 FGM project with the fixes and content from the v1.4 line: contact page, error pages and admin screens no longer crash on undefined template variables; runtime folders are created at startup; newsletter feedback is shown; dashboard counts include drafts; upload errors show a clear message; `multer` upgraded to 2.x; partners, the UNDP success story, programme offices and phone numbers added from HOLIDO's own website.
