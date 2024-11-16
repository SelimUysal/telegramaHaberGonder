const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Güvenlik doğrulamasını devre dışı bırakacak bir HTTPS agent tanımlıyoruz
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const url = 'https://tr.mashable.com/';

async function getMashableNews() {
    try {
        const { data } = await axios.get(url, { httpsAgent });  // Agent'i burada ekledik

        const $ = cheerio.load(data);
        const newsItems = [];

        $('ul#wn li.blogroll a').each((index, element) => {
            const href = $(element).attr('href');
            const title = $(element).find('.caption').text().trim();

            if (href && title) {
                newsItems.push({ href, title });
            }
        });

        const dirPath = path.join(__dirname, 'haber');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }

        const filePath = path.join(dirPath, 'haberler_4.json');
        fs.writeFile(filePath, JSON.stringify(newsItems, null, 2), (err) => {
            if (err) {
                console.error('Dosya kaydedilemedi:', err);
            } else {
                console.log('Mashable haber verileri başarıyla haberler_4.json dosyasına kaydedildi.');
            }
        });

    } catch (error) {
        console.error('Hata oluştu:', error);
    }
}

getMashableNews();
