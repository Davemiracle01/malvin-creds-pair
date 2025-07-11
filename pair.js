

const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Define version information
const version = [2, 3000, 1015901307];

router.get('/', async (req, res) => {
    let num = req.query.number;

    if (!num || !/^\d{8,15}$/.test(num)) {
        return res.status(400).send({ error: '❌ Invalid or missing number parameter' });
    }

    async function PairCode() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(`./session`);

        try {
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);

                if (!res.headersSent) {
                    await res.send({ code, version });
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const {
                    connection,
                    lastDisconnect
                } = s;

                if (connection === "open") {
                    await delay(10000);

                    const credsText = fs.readFileSync('./session/creds.json', 'utf8');

                    await sock.sendMessage(sock.user.id, {
                        text: credsText
                    });

                    await sock.sendMessage(sock.user.id, {
                       text: `🎉 *CREDS.JSON SUCCESSFULLY CREATED*

━━━━━━━━━━━━━━━━━━━━━━━  
✅ *Stage Complete:* Device Linked  
🛰️ *Next Step:* Bot Deployment

📌 *Your Checklist:*  
• Copy the creds.json text above  
• Paste into your GitHub repo in the session folder  
• Launch the bot instance to go live

🧠 *Developer Info:*  
• 👤 *CyberWeebs Dev Team*  
• 📞 [WhatsApp](https://wa.me/254769279076)  
• 🌐 [Cyber Channel](https://whatsapp.com/channel/0029VavpWUvGk1Fkbzz0vz0v)

━━━━━━━━━━━━━━━━━━━━━━━  

💠 *About CyberWeebs:*  
• Glitched Dreams & Code Reality  
• Building futuristic bots with anime-core precision  
• Fields: AI ⚙️ Bots 👾 Automation 💻  
• Motto: _“Code like a hacker, style like an otaku”_

▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰  
*[System ID: CYBERWEEBS-v${version.join('.')}]*`


                    await delay(100);
                    return removeFile('./session');
                }

                if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    PairCode();
                }
            });
        } catch (err) {
            console.log("service restarted");
            removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable", version });
            }
        }
    }

    return await PairCode();
});

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (
        e.includes("conflict") ||
        e.includes("Socket connection timeout") ||
        e.includes("not-authorized") ||
        e.includes("rate-overlimit") ||
        e.includes("Connection Closed") ||
        e.includes("Timed Out") ||
        e.includes("Value not found")
    ) return;
    console.log('Caught exception: ', err);
});

module.exports = router;
