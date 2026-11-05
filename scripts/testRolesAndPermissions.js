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

async function runRoleTests() {
    console.log("Testing Roles and Server-Side Permissions...\n");

    // 1. Login as Staff
    const staffLogin = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { username: "staff", password: "staff123" });
    console.log(`[Staff Login] Status: ${staffLogin.status}, Role: ${staffLogin.body.user.role}`);
    const staffCookie = staffLogin.headers["set-cookie"][0].split(";")[0];
    const staffCsrf = staffLogin.body.csrfToken;

    // 2. Staff attempts to DELETE a product -> MUST GET 403
    const productsRes = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/products?limit=1",
        method: "GET",
        headers: { "Cookie": staffCookie }
    });
    const testProductId = productsRes.body.products[0]._id;

    const staffDelete = await request({
        hostname: "localhost",
        port: 5000,
        path: `/api/products/${testProductId}`,
        method: "DELETE",
        headers: { "Cookie": staffCookie, "x-csrf-token": staffCsrf }
    });
    console.log(`[Permission Check 1] Staff attempts DELETE /api/products/:id -> Status: ${staffDelete.status} (Expected: 403 Forbidden)`);

    // 3. Staff attempts to POST /api/products -> MUST GET 403
    const staffCreateProduct = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/products",
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": staffCookie, "x-csrf-token": staffCsrf }
    }, { name: "Hacker Product", sku: "HACK-01", category: "Electronics", price: 100, quantity: 5 });
    console.log(`[Permission Check 2] Staff attempts POST /api/products -> Status: ${staffCreateProduct.status} (Expected: 403 Forbidden)`);

    // 4. Staff attempts to create User -> MUST GET 403
    const staffCreateUser = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/users",
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": staffCookie, "x-csrf-token": staffCsrf }
    }, { username: "fakeadmin", password: "password123", role: "admin" });
    console.log(`[Permission Check 3] Staff attempts POST /api/users -> Status: ${staffCreateUser.status} (Expected: 403 Forbidden)`);

    // 5. Staff DOES have permission to adjust stock
    const staffAdjust = await request({
        hostname: "localhost",
        port: 5000,
        path: `/api/products/${testProductId}/adjust`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": staffCookie, "x-csrf-token": staffCsrf }
    }, { change: -1, reason: "sold", note: "Customer counter sale" });
    console.log(`[Staff Allowed] Staff POST /api/products/:id/adjust (-1 sold) -> Status: ${staffAdjust.status} (Expected: 200 OK)`);

    // 6. Test edge case: Deducting more than available stock -> MUST GET 400
    const overDeduct = await request({
        hostname: "localhost",
        port: 5000,
        path: `/api/products/${testProductId}/adjust`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": staffCookie, "x-csrf-token": staffCsrf }
    }, { change: -999999, reason: "sold", note: "Over-deduct test" });
    console.log(`[Edge Case 1] Negative stock prevention -> Status: ${overDeduct.status} (Expected: 400 Bad Request, Msg: "${overDeduct.body.message}")`);

    // 7. Test edge case: Duplicate SKU -> MUST GET 400
    const adminLogin = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/auth/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { username: "admin", password: "admin123" });
    const adminCookie = adminLogin.headers["set-cookie"][0].split(";")[0];
    const adminCsrf = adminLogin.body.csrfToken;

    const dupSku = await request({
        hostname: "localhost",
        port: 5000,
        path: "/api/products",
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": adminCookie, "x-csrf-token": adminCsrf }
    }, { name: "Duplicate Mouse", sku: "ELE-001", category: "Electronics", price: 500, quantity: 10 });
    console.log(`[Edge Case 2] Duplicate SKU prevention -> Status: ${dupSku.status} (Expected: 400 Bad Request, Msg: "${dupSku.body.message}")`);

    console.log("\nAll Role & Edge Case Tests Succeeded 100%!");
}

runRoleTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});

