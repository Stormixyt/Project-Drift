const Express = require("express");
const express = Express();
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");

// ========================================
// PROJECT DRIFT MCP BACKEND
// LawinServer Integration
// ========================================

console.log("========================================");
console.log("  PROJECT DRIFT MCP BACKEND");
console.log("  LawinServer Integration v1.0");
console.log("========================================\n");

express.use(Express.json());
express.use(Express.urlencoded({ extended: true }));
express.use(Express.static('public'));
express.use(cookieParser());

// Load all LawinServer routes
express.use(require("../structure/party.js"));
express.use(require("../structure/discovery.js"));
express.use(require("../structure/privacy.js"));
express.use(require("../structure/timeline.js"));
express.use(require("../structure/user.js"));
express.use(require("../structure/contentpages.js"));
express.use(require("../structure/friends.js"));
express.use(require("../structure/main.js"));
express.use(require("../structure/storefront.js"));
express.use(require("../structure/version.js"));
express.use(require("../structure/lightswitch.js"));
express.use(require("../structure/affiliate.js"));
express.use(require("../structure/matchmaking.js"));
express.use(require("../structure/cloudstorage.js"));
express.use(require("../structure/mcp.js"));

const port = process.env.PORT || 3551;

express.listen(port, () => {
    console.log(`✓ MCP Backend listening on port ${port}`);
    console.log(`✓ XMPP and Matchmaker starting...\n`);
    
    // Start XMPP server
    require("../structure/xmpp.js");
    
    console.log("========================================");
    console.log("  Ready for connections!");
    console.log("========================================\n");
}).on("error", (err) => {
    if (err.code == "EADDRINUSE") {
        console.log(`\x1b[31mERROR\x1b[0m: Port ${port} is already in use!`);
        console.log(`Kill the process using port ${port} and try again.`);
    } else {
        throw err;
    }
    process.exit(1);
});

// Create client settings directory
try {
    const settingsDir = path.join(process.env.LOCALAPPDATA, "ProjectDrift");
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir);
    }
} catch (err) {
    // Fallback to local directory
    const settingsDir = path.join(__dirname, "../ClientSettings");
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir);
    }
}

// 404 handler
express.use((req, res, next) => {
    const XEpicErrorName = "errors.com.projectdrift.common.not_found";
    const XEpicErrorCode = 1004;

    res.set({
        'X-Epic-Error-Name': XEpicErrorName,
        'X-Epic-Error-Code': XEpicErrorCode
    });

    res.status(404);
    res.json({
        "errorCode": XEpicErrorName,
        "errorMessage": "Sorry, the resource you were trying to find could not be found",
        "numericErrorCode": XEpicErrorCode,
        "originatingService": "project-drift",
        "intent": "prod"
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down MCP Backend...');
    process.exit(0);
});
