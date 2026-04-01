const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Opening page...');
        const page = await browser.newPage();
        console.log('Setting content...');
        await page.setContent('<h1>Test PDF</h1>', { waitUntil: 'networkidle0' });
        console.log('Generating PDF...');
        const buffer = await page.pdf({ format: 'A4' });
        console.log('PDF Generated. Length:', buffer.length);
        await browser.close();
        if (buffer.length > 0) {
            console.log('SUCCESS');
        } else {
            console.log('FAILURE: Empty buffer');
        }
    } catch (e) {
        console.error('ERROR:', e);
    }
})();
