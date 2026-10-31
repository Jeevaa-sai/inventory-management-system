# Inventory Management System (Web Technology Semester Project)

A full-stack, syllabus-compliant Web Technology application built with **HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and MongoDB (Mongoose)**.

## Project Structure
```text
Inventory Management System/
├── package.json                   # Dependencies (express, mongoose) & start script
├── server.js                      # Express app setup, MongoDB connection, static serving (Port 5000)
├── models/
│   ├── Product.js                 # Mongoose Schema & Model for inventory products
│   └── User.js                    # Mongoose Schema & Model for user accounts (RBAC)
├── routes/
│   ├── authRoutes.js              # Authentication endpoints (/api/auth/login, /api/auth/init)
│   └── productRoutes.js           # Product CRUD & stock adjustment endpoints (/api/products)
├── public/
│   ├── index.html                 # Semantic HTML5 user interface (Login + Dashboard)
│   ├── style.css                  # Clean CSS styling (Flexbox, Grid, Table, Badges)
│   └── script.js                  # Frontend JavaScript (fetch API, DOM manipulation)
├── LINE_BY_LINE_EXPLANATION.md    # Comprehensive line-by-line viva guide & exam answers
└── README.md                      # Project documentation
```

## How to Run

1. Open your terminal in this directory:
   ```bash
   cd "d:\Projects\Inventory Management System"
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```text
   http://localhost:5000
   ```

## Demo Credentials
* **Admin Account:** `admin` / `admin123` (Full permissions: Add, Edit, Delete, Stock In/Out)
* **Staff Account:** `staff` / `staff123` (Stock updates & view only)

