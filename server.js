import express from 'express';
import puppeteer from 'puppeteer-core';
import chrome from 'chrome-aws-lambda';  // chrome-aws-lambda をインポート
import path from 'path';

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
        // chrome-aws-lambdaの設定を適用
        const browserOptions = {
            executablePath: await chrome.executablePath,  // chrome-aws-lambda が提供する Chrome のパス
            args: chrome.args,  // chrome-aws-lambda の引数
            headless: chrome.headless,  // ヘッドレスモード
        };

        browser = await puppeteer.launch(browserOptions);  // puppeteer を起動
        const page = await browser.newPage();

        console.log('Navigating to URL:', url);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        console.log('Waiting for #react-root...');
        await page.waitForSelector('#react-root', { timeout: 10000 }).catch((err) => {
            console.error('Error waiting for selector:', err);
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
        res.status(500).json({ error: `Failed to process the URL: ${error.message}` });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
