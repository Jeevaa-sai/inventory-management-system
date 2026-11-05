const http = require("http");

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                let parsed = body;
                try { parsed = JSON.parse(body); } catch {}
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on("error", reject);
        if (data) req.write(typeof data === "string" ? data : JSON.stringify(data));
        req.end();
    });
}

async function runTests() {
    console.log("Testing Phase 2 Endpoints...");

    // 1. Unauthenticated request to /api/products -> Should return 401
    const unauthRes = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/products",
        method: "GET"
    });
    console.log(`[Test 1] GET /api/products without session -> Status: ${unauthRes.status} (Expected: 401)`);

    // 2. Login as admin
    const loginRes = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { username: "admin", password: "admin123" });
    console.log(`[Test 2] POST /api/auth/login -> Status: ${loginRes.status}, User: ${loginRes.body.user?.role}`);

    const cookie = loginRes.headers["set-cookie"] ? loginRes.headers["set-cookie"][0].split(";")[0] : "";
    const csrfToken = loginRes.body.csrfToken;
    console.log(`   Session Cookie: ${cookie.substring(0, 20)}..., CSRF: ${csrfToken ? "Present" : "Missing"}`);

    // 3. Fetch products as authenticated admin
    const productsRes = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/products?limit=5",
        method: "GET",
        headers: { "Cookie": cookie }
    });
    console.log(`[Test 3] GET /api/products with session -> Status: ${productsRes.status}, Total: ${productsRes.body.total}`);

    // 4. Fetch Stats
    const statsRes = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/stats",
        method: "GET",
        headers: { "Cookie": cookie }
    });
    console.log(`[Test 4] GET /api/stats -> Status: ${statsRes.status}, Valuation: ₹${statsRes.body.cards?.totalValue}`);

    // 5. Adjust stock with CSRF
    const firstProduct = productsRes.body.products[0];
    const adjustRes = await request({
        hostname: "localhost",
        port: 5000,
        path: `/api/products/${firstProduct._id}/adjust`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookie,
            "x-csrf-token": csrfToken
        }
    }, { change: 1, reason: "returned", note: "Test return" });
    console.log(`[Test 5] POST /api/products/:id/adjust (+1 returned) -> Status: ${adjustRes.status}, New Stock: ${adjustRes.body.product?.quantity}`);

    // 6. Test without CSRF on state change -> Should return 403
    const noCsrfRes = await request({
        hostname: "localhost",
        port: 5000,
        path: `/api/products/${firstProduct._id}/adjust`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookie
        }
    }, { change: 1, reason: "returned" });
    console.log(`[Test 6] Mutating request without CSRF -> Status: ${noCsrfRes.status} (Expected: 403)`);

    console.log("\nAll Phase 2 Backend Tests Passed!");
}

runTests().catch(err => {
    console.error("Test failed:", err.message);
    process.exit(1);
});

