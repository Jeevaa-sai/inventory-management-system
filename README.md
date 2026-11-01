# Inventory Management System (MERN Stack)

Full-stack MERN (MongoDB, Express, React, Node.js) web application for Web Technology course project.

## Technology Stack
- **M**ongoDB: NoSQL Database with Mongoose ODM
- **E**xpress.js: Backend REST API server
- **R**eact.js: Frontend User Interface (with Hooks: useState, useEffect)
- **N**ode.js: JavaScript Server Runtime

## Project Structure
```text
Inventory Management System/
├── client/                        # React Frontend (Vite + React)
│   ├── src/
│   │   ├── App.jsx                # Main React Component (State, Hooks, UI)
│   │   ├── App.css                # Component Styling
│   │   └── main.jsx               # React entry point
│   └── package.json               # Frontend dependencies
├── models/
│   ├── Product.js                 # Product Mongoose Schema
│   └── User.js                    # User Mongoose Schema (Roles)
├── routes/
│   ├── authRoutes.js              # Login API
│   └── productRoutes.js           # Product CRUD & Stock Adjust API
├── server.js                      # Express backend & static React hosting
├── package.json                   # Backend dependencies
└── LINE_BY_LINE_EXPLANATION.md    # Complete viva guide
```

## How to Run

1. Install backend dependencies:
   ```bash
   npm install
   ```

2. Install frontend dependencies:
   ```bash
   cd client
   npm install
   cd ..
   ```

3. Build the React frontend:
   ```bash
   npm run build
   ```

4. Make sure MongoDB is running locally.

5. Start the server:
   ```bash
   npm start
   ```

6. Open your browser:
   ```text
   http://localhost:5000
   ```

## Demo Accounts
- **Admin:** `admin` / `admin123` (Full permissions)
- **Staff:** `staff` / `staff123` (View and stock updates only)
