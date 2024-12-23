import express from 'express';
import puppeteer from 'puppeteer-core';  // puppeteer-coreを使用
import path from 'path';
import chrome from 'chrome-aws-lambda';  // chrome-aws-lambdaを使用

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 静的ファイル（HTMLなど）を提供する
app.use(express.static('public'));

// ルートでindex.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/fetch-url', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    let browser;
    try {
        // Puppeteerの設定にchrome-aws-lambdaを使用
        const browserOptions = {
            executablePath: await chrome.executablePath,  // Renderで使用するChromeのパス
            args: chrome.args,  // chrome-aws-lambdaの引数
            headless: chrome.headless,  // ヘッドレスモード
        };

        browser = await puppeteer.launch(browserOptions);  // puppeteerを起動
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle0' });

        await page.waitForSelector('#react-root', { timeout: 5000 }).catch(() => {
            throw new Error("Failed to locate #react-root on the page.");
        });

        const reactRootText = await page.$eval('#react-root', element => element.textContent || '');
        const cleanedText = reactRootText
            .replace(/「いま.*?会話/g, "")
            .replace(/フォロークリックして./g, "\n")
            .replace(/さんをフォロー/g, "\n")
            .replace(/(午前|午後)\d{1,2}(:\d{1,2})?\s*[^0-9]*$/g, "")
            .replace(/([0-9]{1,2}(:[0-9]{1,2})?\s*·.*)?$/g, "")
            .trim();

        const imageSrcs = await page.$$eval('#react-root img[alt="画像"]', imgs =>
            imgs.map(img => img.src)
        );

        res.json({ cleanedText, imageSrcs });
    } catch (error) {
        console.error(`Error processing URL: ${error.message}`, error);
        res.status(500).json({ error: 'Failed to process the URL.' });
    } finally {
        if (browser) await browser.close();
    }
});

// Renderでは環境変数PORTを使用
app.listen(PORT, () => {
    console.log(`Server is running`);
});
