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

## Version 1.6.0 homepage marquee

Adds an "In the field" photo marquee to the homepage (below the thematic-area strip). Five HOLIDO field and office photographs are stored in `public/images/marquee/` (resized to 700px height). The strip scrolls continuously, pauses on hover or keyboard focus, and becomes a manually scrollable strip for visitors who prefer reduced motion. To change the photos or captions, edit the `fieldPhotos` list at the top of the marquee block in `views/page.ejs`. HOLIDO should confirm consent for publishing photographs of identifiable community members and children before launch.

## Version 1.7.0 — hero slider, marquee fix and smoother interface

**Homepage hero slider** (`views/page.ejs`, top of the home block). Five slides driven by the `heroSlides` list: edit text, links, photos and focal points there. Autoplay (7 s) with story-style progress bars; previous/next buttons, clickable bars, swipe/drag, ← → keys, and a pause button. Pauses on hover, keyboard focus, when the tab is hidden or the hero is off-screen. Honours `prefers-reduced-motion` (no autoplay). Portrait photos are shown as a framed print over a blurred backdrop of the same photo so they stay sharp. Without JavaScript the first slide shows normally.

**Marquee fix.** Root cause: photos were `loading="lazy"` with no width/height inside a scrolling track, so un-loaded images had zero width, the track length was wrong and the loop jumped or left gaps. Now images carry intrinsic dimensions and load normally; `site.js` clones the photo set as many times as the screen needs (so ultra-wide screens never show a gap), scrolls at a constant speed on every screen size, pauses on hover (desktop), off-screen, and via a visible Pause/Play button (WCAG 2.2.2). With reduced motion or no JS it is a swipeable strip.

**Smoothness.** Removed the page-wide `perspective` on `<body>` (it forced extra compositing and caused jank); card tilt now uses a local `perspective()`. Added: animated dropdowns and mobile menu (closes on Escape / outside click / link tap), tactile button press state, soft cross-fade between pages (View Transitions, where supported), restrained reveal for cards below the fold, header shadow on scroll, skip-to-content link and visible keyboard focus rings.
