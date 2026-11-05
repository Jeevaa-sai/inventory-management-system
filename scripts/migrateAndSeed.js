const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");

const MONGO_URI = "mongodb://127.0.0.1:27017/inventoryDB";

async function runMigrationAndSeed() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    // --- STEP 1: MIGRATE & SEED USERS ---
    console.log("\n[1/5] Migrating and verifying Users...");
    const defaultUsers = [
        { username: "admin", password: "admin123", role: "admin", fullName: "Administrator" },
        { username: "manager", password: "manager123", role: "manager", fullName: "Store Manager" },
        { username: "staff", password: "staff123", role: "staff", fullName: "Floor Staff" }
    ];

    for (const u of defaultUsers) {
        const existing = await User.findOne({ username: u.username });
        if (!existing) {
            const hashedPassword = await bcrypt.hash(u.password, 10);
            await User.create({
                username: u.username,
                password: hashedPassword,
                role: u.role,
                fullName: u.fullName,
                active: true
            });
            console.log(` Created default user: ${u.username} (${u.role})`);
        } else {
            // Migrate password to bcrypt if it is plain text
            const isHashed = existing.password.startsWith("$2a$") || existing.password.startsWith("$2b$");
            if (!isHashed) {
                existing.password = await bcrypt.hash(existing.password, 10);
                await existing.save();
                console.log(` Migrated password to bcrypt for: ${existing.username}`);
            }
        }
    }

    const adminUser = await User.findOne({ username: "admin" });
    const managerUser = await User.findOne({ username: "manager" }) || adminUser;
    const staffUser = await User.findOne({ username: "staff" }) || adminUser;
    const allUsers = [adminUser, managerUser, staffUser];

    // --- STEP 2: MIGRATE EXISTING PRODUCTS TO HAVE SKU & REORDER_LEVEL ---
    console.log("\n[2/5] Migrating existing products...");
    const existingProducts = await Product.find();
    for (let i = 0; i < existingProducts.length; i++) {
        const p = existingProducts[i];
        let needsSave = false;
        if (!p.sku) {
            const prefix = p.category ? p.category.substring(0, 3).toUpperCase() : "PRD";
            p.sku = `${prefix}-${String(100 + i)}`;
            needsSave = true;
        }
        if (p.reorder_level === undefined || p.reorder_level === null) {
            p.reorder_level = p.minStock !== undefined ? p.minStock : 5;
            needsSave = true;
        }
        if (p.minStock === undefined) {
            p.minStock = p.reorder_level;
            needsSave = true;
        }
        if (needsSave) {
            await p.save();
            console.log(` Updated existing product with SKU: ${p.sku}`);
        }
    }

    // --- STEP 3: SEED SUPPLIERS ---
    console.log("\n[3/5] Seeding Suppliers...");
    const suppliersData = [
        {
            name: "Apex Electronics Wholesale",
            contact_person: "Rajesh Sharma",
            phone: "+91 98450 12345",
            email: "sales@apexelectronics.in"
        },
        {
            name: "Metro Office & Stationery Mart",
            contact_person: "Priya Sundaram",
            phone: "+91 94440 23456",
            email: "orders@metrostations.com"
        },
        {
            name: "Godrej & Horizon Furniture Hub",
            contact_person: "Vikram Malhotra",
            phone: "+91 97110 34567",
            email: "commercial@horizonfurniture.in"
        },
        {
            name: "CleanPro Industrial Supplies",
            contact_person: "Anita Desai",
            phone: "+91 93220 45678",
            email: "dispatch@cleanproindia.com"
        },
        {
            name: "Heritage Pantry & Beverages Ltd",
            contact_person: "Karthik Nair",
            phone: "+91 98840 56789",
            email: "b2b@heritagepantry.in"
        }
    ];

    const seededSuppliers = [];
    for (const s of suppliersData) {
        let sup = await Supplier.findOne({ name: s.name });
        if (!sup) {
            sup = await Supplier.create(s);
            console.log(` Created supplier: ${sup.name}`);
        }
        seededSuppliers.push(sup);
    }

    // --- STEP 4: SEED 35 REALISTIC OFFICE PRODUCTS ---
    console.log("\n[4/5] Seeding 35 office products across 5 categories...");
    const fullProductsCatalog = [
        // Category 1: Electronics (7 products)
        { name: "Wireless Optical Mouse", sku: "ELE-001", category: "Electronics", price: 650, quantity: 45, reorder_level: 10 },
        { name: "Ergonomic Mechanical Keyboard", sku: "ELE-002", category: "Electronics", price: 2850, quantity: 18, reorder_level: 5 },
        { name: "USB-C Multiport Adapter 7-in-1", sku: "ELE-003", category: "Electronics", price: 1750, quantity: 24, reorder_level: 6 },
        { name: "HDMI 4K Cable 2-Meter", sku: "ELE-004", category: "Electronics", price: 380, quantity: 38, reorder_level: 8 },
        { name: "HD 1080p Conference Webcam", sku: "ELE-005", category: "Electronics", price: 3200, quantity: 12, reorder_level: 4 },
        { name: "Noise Cancelling USB Headset", sku: "ELE-006", category: "Electronics", price: 2150, quantity: 3, reorder_level: 5 }, // Low Stock!
        { name: "65W GaN Fast Wall Charger", sku: "ELE-007", category: "Electronics", price: 1450, quantity: 0, reorder_level: 6 }, // Out of stock!

        // Category 2: Stationery (7 products)
        { name: "A4 Copier Paper 75GSM (Ream of 500)", sku: "STA-001", category: "Stationery", price: 340, quantity: 60, reorder_level: 15 },
        { name: "Executive Gel Pens 0.5mm (Pack of 10)", sku: "STA-002", category: "Stationery", price: 199, quantity: 75, reorder_level: 20 },
        { name: "Permanent Chisel Markers 4-Color Set", sku: "STA-003", category: "Stationery", price: 160, quantity: 28, reorder_level: 10 },
        { name: "Heavy Duty Desktop Metal Stapler", sku: "STA-004", category: "Stationery", price: 420, quantity: 15, reorder_level: 5 },
        { name: "Pastel Sticky Notes 3x3 (Pack of 6)", sku: "STA-005", category: "Stationery", price: 220, quantity: 4, reorder_level: 10 }, // Low Stock!
        { name: "Hardbound Ruled Meeting Notebook", sku: "STA-006", category: "Stationery", price: 280, quantity: 35, reorder_level: 8 },
        { name: "Stainless Steel Scissors 8-Inch", sku: "STA-007", category: "Stationery", price: 140, quantity: 22, reorder_level: 5 },

        // Category 3: Furniture (7 products)
        { name: "High-Back Ergonomic Mesh Chair", sku: "FUR-001", category: "Furniture", price: 8900, quantity: 8, reorder_level: 3 },
        { name: "Adjustable Dual Monitor Desk Mount", sku: "FUR-002", category: "Furniture", price: 3450, quantity: 14, reorder_level: 4 },
        { name: "Memory Foam Ergonomic Lumbar Pillow", sku: "FUR-003", category: "Furniture", price: 950, quantity: 20, reorder_level: 5 },
        { name: "Under-Desk Ergonomic Footrest", sku: "FUR-004", category: "Furniture", price: 1250, quantity: 11, reorder_level: 4 },
        { name: "Mobile 3-Drawer Steel File Cabinet", sku: "FUR-005", category: "Furniture", price: 5600, quantity: 5, reorder_level: 2 },
        { name: "Magnetic Whiteboard 4x3 Feet", sku: "FUR-006", category: "Furniture", price: 2200, quantity: 2, reorder_level: 3 }, // Low Stock!
        { name: "Desktop Cable Management Spine", sku: "FUR-007", category: "Furniture", price: 780, quantity: 16, reorder_level: 4 },

        // Category 4: Cleaning Supplies (7 products)
        { name: "Disinfectant Surface Spray 500ml", sku: "CLN-001", category: "Cleaning Supplies", price: 210, quantity: 32, reorder_level: 10 },
        { name: "Microfiber Cleaning Cloths (Pack of 5)", sku: "CLN-002", category: "Cleaning Supplies", price: 180, quantity: 40, reorder_level: 8 },
        { name: "Liquid Hand Wash Anti-Bacterial 5L", sku: "CLN-003", category: "Cleaning Supplies", price: 650, quantity: 9, reorder_level: 4 },
        { name: "Heavy Duty Biodegradable Trash Bags 50L", sku: "CLN-004", category: "Cleaning Supplies", price: 290, quantity: 25, reorder_level: 8 },
        { name: "Screen & Monitor Cleansing Wipes (100pk)", sku: "CLN-005", category: "Cleaning Supplies", price: 350, quantity: 19, reorder_level: 5 },
        { name: "Floor Cleaner Citrus Disinfectant 2L", sku: "CLN-006", category: "Cleaning Supplies", price: 320, quantity: 14, reorder_level: 5 },
        { name: "Aerosol Air Freshener Lavender 300ml", sku: "CLN-007", category: "Cleaning Supplies", price: 175, quantity: 0, reorder_level: 6 }, // Out of stock!

        // Category 5: Office Pantry (7 products)
        { name: "Premium Arabica Coffee Beans 1kg", sku: "PAN-001", category: "Office Pantry", price: 1150, quantity: 22, reorder_level: 6 },
        { name: "Assorted Herbal Green Tea Bags (Pack of 100)", sku: "PAN-002", category: "Office Pantry", price: 480, quantity: 30, reorder_level: 8 },
        { name: "Pure Dairy Milk Powder 1kg Pack", sku: "PAN-003", category: "Office Pantry", price: 420, quantity: 18, reorder_level: 5 },
        { name: "Refined White Sugar Sachets (Pack of 200)", sku: "PAN-004", category: "Office Pantry", price: 260, quantity: 26, reorder_level: 6 },
        { name: "Almond & Honey Granola Energy Bars (24pk)", sku: "PAN-005", category: "Office Pantry", price: 890, quantity: 3, reorder_level: 6 }, // Low Stock!
        { name: "Insulated Paper Hot Cups 250ml (100pk)", sku: "PAN-006", category: "Office Pantry", price: 320, quantity: 45, reorder_level: 15 },
        { name: "Lemon Mint Refreshment Squash 1L", sku: "PAN-007", category: "Office Pantry", price: 240, quantity: 17, reorder_level: 5 }
    ];

    const allSeededProducts = [];
    for (const p of fullProductsCatalog) {
        let existing = await Product.findOne({ sku: p.sku });
        if (!existing) {
            existing = await Product.create(p);
            console.log(` Created product: [${p.sku}] ${p.name} (Qty: ${p.quantity})`);
        } else {
            // Keep existing quantity, ensure category, price, reorder_level are up to date
            existing.reorder_level = p.reorder_level;
            existing.minStock = p.reorder_level;
            await existing.save();
        }
        allSeededProducts.push(existing);
    }

    // --- STEP 5: SEED 30 DAYS OF REALISTIC STOCK MOVEMENTS ---
    console.log("\n[5/5] Checking and seeding 30-day stock movements...");
    const existingMovementsCount = await StockMovement.countDocuments();
    if (existingMovementsCount < 30) {
        console.log(` Generating ~30 days of realistic movement history for analytics...`);
        const reasons = ["sold", "sold", "sold", "restock", "returned", "damaged", "correction"];
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        for (let day = 30; day >= 0; day--) {
            const dayTimestamp = new Date(now - day * 24 * 60 * 60 * 1000 + (Math.random() * 8 * 3600 * 1000));
            // 2 to 4 transactions per day
            const txCount = 2 + Math.floor(Math.random() * 3);
            for (let t = 0; t < txCount; t++) {
                const product = allSeededProducts[Math.floor(Math.random() * allSeededProducts.length)];
                const reason = reasons[Math.floor(Math.random() * reasons.length)];
                const user = allUsers[Math.floor(Math.random() * allUsers.length)];

                let change = 0;
                let note = "";
                if (reason === "sold") {
                    change = -(1 + Math.floor(Math.random() * 4));
                    note = `Customer order #${1000 + Math.floor(Math.random() * 9000)}`;
                } else if (reason === "restock" || reason === "purchase_order") {
                    change = 5 + Math.floor(Math.random() * 20);
                    note = `Supplier delivery intake`;
                } else if (reason === "returned") {
                    change = 1;
                    note = `Customer exchange/return`;
                } else if (reason === "damaged") {
                    change = -1;
                    note = `Damaged in transit`;
                } else {
                    change = Math.random() > 0.5 ? 2 : -2;
                    note = `Monthly cycle count audit`;
                }

                const simulatedStockAfter = Math.max(0, product.quantity + change);

                await StockMovement.create({
                    product_id: product._id,
                    change: change,
                    reason: reason,
                    note: note,
                    user_id: user ? user._id : null,
                    stock_after: simulatedStockAfter,
                    created_at: dayTimestamp
                });
            }
        }
        console.log(" Seeded 30 days of stock movement history successfully.");
    } else {
        console.log(` Found ${existingMovementsCount} existing movements. Skipping movement re-seed.`);
    }

    // --- STEP 6: SEED SAMPLE PURCHASE ORDERS ---
    console.log("\nVerifying Purchase Orders...");
    const poCount = await PurchaseOrder.countDocuments();
    if (poCount === 0) {
        const sampleOrders = [
            {
                product_id: allSeededProducts[6]._id, // 65W GaN Fast Wall Charger (Out of stock)
                supplier_id: seededSuppliers[0]._id, // Apex Electronics
                quantity: 30,
                status: "pending",
                created_by: managerUser._id,
                created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000)
            },
            {
                product_id: allSeededProducts[27]._id, // Aerosol Air Freshener (Out of stock)
                supplier_id: seededSuppliers[3]._id, // CleanPro
                quantity: 40,
                status: "pending",
                created_by: managerUser._id,
                created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000)
            },
            {
                product_id: allSeededProducts[0]._id, // Wireless Optical Mouse
                supplier_id: seededSuppliers[0]._id,
                quantity: 25,
                status: "received",
                created_by: adminUser._id,
                created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000),
                received_at: new Date(Date.now() - 7 * 24 * 3600 * 1000)
            }
        ];
        await PurchaseOrder.create(sampleOrders);
        console.log(" Seeded initial purchase orders (pending and received).");
    }

    console.log("\nMigration and seeding complete! Database is primed.");
    await mongoose.disconnect();
}

runMigrationAndSeed().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});

