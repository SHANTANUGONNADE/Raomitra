# Roamitra — Travel Agency Website

A modern travel community platform built with HTML5, CSS3, Bootstrap 5, Vanilla JavaScript, PHP 8+, and MariaDB.

## Phase 1: Frontend (Current)

Frontend-only development. Backend integration will begin after frontend approval.

## Quick Start

1. Place the project in your XAMPP `htdocs` folder
2. Start Apache in XAMPP
3. Open: `http://localhost/Roamitrawebsite/public/index.html`

**Admin Login**

- Email: `admin@raomitra.com`
- Password: `Admin1234!`

## Project Structure

```
Roamitrawebsite/
├── public/                          # Web root (Phase 1)
│   ├── index.html                   # Homepage
│   ├── explore.html                 # (Upcoming)
│   ├── community.html               # (Upcoming)
│   ├── login.html                   # (Upcoming)
│   ├── signup.html                  # (Upcoming)
│   └── assets/
│       ├── css/
│       │   ├── main.css             # Main stylesheet
│       │   ├── variables.css        # Design tokens
│       │   └── components/          # Component styles
│       ├── js/
│       │   ├── main.js              # Page interactions
│       │   ├── components.js        # Component loader
│       │   └── ai-assistant.js      # AI chat UI
│       ├── components/              # Reusable HTML partials
│       │   ├── navbar.html
│       │   ├── footer.html
│       │   └── ai-assistant.html
│       └── images/                  # Static images
├── app/                             # Backend (Phase 2+)
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── middleware/
│   └── helpers/
├── database/                        # SQL scripts (Phase 2+)
│   └── migrations/
├── routes/                          # URL routing (Phase 2+)
└── README.md
```



## Tech Stack


| Layer    | Technology                           |
| -------- | ------------------------------------ |
| Frontend | HTML5, CSS3, Bootstrap 5, Vanilla JS |
| Backend  | PHP 8+, PDO, MVC-like structure      |
| Database | MariaDB                              |




## User Roles (Planned)

- **Admin** — Full platform control
- **Co-Admin** — Host application review
- **Customer** — Browse, book, apply to host



## Development Workflow

1. ✅ Requirements analysis & folder structure
2. ✅ Homepage frontend
3. ⏳ Awaiting approval → Continue page by page
4. ⏳ Backend & database (after frontend complete)
5. ⏳ Integration



## License

Proprietary — All rights reserved.