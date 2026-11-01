# Inventory Management System

Web Technology semester project built using HTML, CSS, JavaScript, Node.js, Express, and MongoDB.

## Project Files
- `server.js` - Express backend server and MongoDB connection
- `models/Product.js` - Product database schema (name, category, price, quantity, minStock)
- `models/User.js` - User schema for login and roles (admin and staff)
- `routes/authRoutes.js` - User login route
- `routes/productRoutes.js` - Product CRUD operations and stock adjustment
- `public/index.html` - Main HTML interface with login and inventory dashboard
- `public/style.css` - Simple CSS styling
- `public/script.js` - Frontend JavaScript fetch calls and DOM updates
- `LINE_BY_LINE_EXPLANATION.md` - Line-by-line code explanation for viva

## Setup and Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Make sure MongoDB is running locally.

3. Start the server:
   ```bash
   npm start
   ```

4. Open browser and visit:
   ```text
   http://localhost:5000
   ```

## Demo Accounts
- **Admin:** `admin` / `admin123` (Can add, edit, delete, and adjust stock)
- **Staff:** `staff` / `staff123` (Can view products and adjust stock)
