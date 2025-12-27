import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const CREDENTIALS = {
    username: 'RozitaBina', 
    password: 'HQRozita@_2512'
};

const REFRESH_RATE = 5 * 60 * 1000; // Update lebih kerap (setiap 5 minit) sebab data hari ini

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'public', 'tcn-data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

async function runGhost() {
    console.log(`\n[${new Date().toLocaleTimeString()}] 👻 Hantu TCN (V8: Hari Ini Sahaja) bangun...`);
    
    // HEADLESS FALSE: Wajib untuk script website berfungsi
    const browser = await puppeteer.launch({
        headless: false, 
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 1. LOGIN
        console.log('   🔐 Melayari os.ourvend.com...');
        await page.goto('https://os.ourvend.com/Account/Login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));

        let usernameInput = await page.$('#PbUser_UserName') || await page.$('input[name*="UserName"]') || await page.$('input[type="text"]');
        if (usernameInput) {
            await usernameInput.click();
            await page.evaluate(el => el.value = '', usernameInput);
            await usernameInput.type(CREDENTIALS.username, { delay: 50 });
            let passwordInput = await page.$('#PbUser_Password') || await page.$('input[type="password"]');
            if(passwordInput) {
                await passwordInput.type(CREDENTIALS.password, { delay: 50 });
                await page.keyboard.press('Enter');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
            }
        }

        if (page.url().includes('Login')) throw new Error("Login gagal!");
        console.log('   🎉 Login Sah Berjaya!');

        // --- MISI 1: DATA MESIN (Kekalkan) ---
        console.log('   🤖 Misi 1: Menyedut Data Mesin...');
        await new Promise(r => setTimeout(r, 2000));

        const machineData = await page.evaluate(async () => {
            try {
                const response = await fetch('/OperateMonitor/ListJson?_search=false&rows=100&page=1&sidx=MiNoline&sord=desc', {
                    method: 'GET',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                return await response.json();
            } catch (err) { return { error: err.toString() }; }
        });

        if (machineData && machineData.rows) {
            fs.writeFileSync(path.join(DATA_DIR, 'machines.json'), JSON.stringify(machineData, null, 2));
            console.log(`   📦 [Machines] Sukses! ${machineData.rows.length} mesin ditemui.`);
        }

        // --- MISI 2: DATA SALES (HARI INI) ---
        console.log('   🚀 Misi 2: Navigasi ke Page Sales...');
        
        let salesCaptured = [];
        
        // PLAN A: Network Spy
        page.on('response', async (response) => {
            const url = response.url();
            if (url.toLowerCase().includes('salelistjson') && response.request().method() === 'POST') {
                try {
                    const json = await response.json();
                    if (json && json.rows) {
                        salesCaptured = json.rows;
                        console.log(`   🎯 Network Spy: Dapat ${json.rows.length} transaksi (dari network)!`);
                    }
                } catch (e) {}
            }
        });

        await page.goto('https://os.ourvend.com/SaleDetail/Index', { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('   👀 Page Sales loaded. Mengunci tarikh: HARI INI...');

        // 1. SET TARIKH "HARI INI"
        await page.evaluate(() => {
            const today = new Date();
            const fmt = d => d.toISOString().split('T')[0]; // Format: YYYY-MM-DD
            const todayStr = fmt(today);
            
            // Set StartDate & EndDate kepada hari ini
            if(document.querySelector('#StartDate')) document.querySelector('#StartDate').value = todayStr;
            if(document.querySelector('#EndDate')) document.querySelector('#EndDate').value = todayStr;
        });

        // 2. TEKAN SEARCH
        console.log('   🖱️ Menekan butang Search (Data Hari Ini)...');
        await page.evaluate(() => {
            // Kita cari butang search dengan lebih agresif
            const btn = document.getElementById('btnSearch');
            if(btn) {
                btn.click();
            } else {
                // Kalau tak jumpa ID, cari class
                const btnClass = document.querySelector('.btn-search');
                if(btnClass) btnClass.click();
            }
        });

        // Tunggu loading (spinner) habis
        await new Promise(r => setTimeout(r, 5000));

        // --- PLAN B: SCRAPE JADUAL (Khas untuk hari ini) ---
        if (!salesCaptured || salesCaptured.length === 0) {
            console.log('   ⚠️ Spy tak dapat data. Tukar ke Plan B: Baca Jadual di Skrin...');
            
            salesCaptured = await page.evaluate(() => {
                const rows = document.querySelectorAll('#gridTable tr.jqgrow');
                const results = [];
                
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    // Index column mungkin berbeza ikut user, kita ambil semua yang nampak
                    if (cells.length > 5) {
                        results.push({
                            TradeTime: cells[3]?.innerText || '', // Tarikh/Masa
                            MiName: cells[4]?.innerText || '',    // Nama Mesin
                            ProductName: cells[6]?.innerText || '', // Nama Produk
                            Amount: cells[8]?.innerText || '0',     // Harga
                            PayType: cells[9]?.innerText || 'Cash', // Cara Bayar
                            Status: 'Success'
                        });
                    }
                });
                return results;
            });
            console.log(`   👁️ Mata Robot: Nampak ${salesCaptured.length} transaksi hari ini.`);
        }

        // 3. SIMPAN DATA
        const finalData = { 
            lastUpdated: new Date().toISOString(),
            rows: salesCaptured 
        };
        
        // Walaupun 0, kita simpan juga supaya Dashboard tahu "Hari ni 0 sales"
        const salesPath = path.join(DATA_DIR, 'sales.json');
        fs.writeFileSync(salesPath, JSON.stringify(finalData, null, 2));
        
        if (salesCaptured.length > 0) {
            console.log(`   📦 [Sales] SUKSES! ${salesCaptured.length} transaksi hari ini disimpan.`);
            console.log(`      (Sampel: RM${salesCaptured[0].Amount} - ${salesCaptured[0].ProductName})`);
        } else {
            console.log('   📉 Tiada jualan ditemui untuk hari ini (atau belum masuk lagi). Fail sales.json dikosongkan.');
        }

    } catch (error) {
        console.error('   ❌ Error:', error.message);
    } finally {
        await browser.close();
        console.log(`   💤 Selesai. Rehat ${REFRESH_RATE/60000} minit.`);
        setTimeout(runGhost, REFRESH_RATE);
    }
}

runGhost();