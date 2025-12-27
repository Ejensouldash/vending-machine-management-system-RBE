import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3001; // Kita guna port lain supaya tak gaduh dengan Dashboard (3000)

const server = http.createServer((req, res) => {
    // 1. Setup CORS (Biar Chrome Extension boleh akses)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 2. Handle POST request untuk simpan data
    if (req.url === '/api/tcn-bridge' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { type, payload } = data;

                // Tentukan lokasi simpan
                const dataDir = path.join(__dirname, 'public', 'tcn-data');
                if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

                let fileName = '';
                if (type === 'SALES') fileName = 'sales.json';
                if (type === 'MACHINES') fileName = 'machines.json';

                if (fileName) {
                    const filePath = path.join(dataDir, fileName);
                    
                    // Format data cantik-cantik
                    const finalData = {
                        lastUpdated: new Date().toISOString(),
                        rows: payload
                    };

                    fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
                    console.log(`[BRIDGE] ✅ Data ${type} berjaya disimpan di public/tcn-data/${fileName}`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Saved!' }));
                } else {
                    throw new Error('Jenis data tidak dikenali');
                }
            } catch (e) {
                console.error('[BRIDGE] ❌ Error:', e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, message: e.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 Server Jambatan TCN sedang berjalan di http://localhost:${PORT}`);
    console.log(`📂 Menunggu data dari Chrome Extension...\n`);
});