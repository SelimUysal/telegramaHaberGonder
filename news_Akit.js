// npm install puppeteer-extra puppeteer-extra-plugin-stealth fs
// npm i puppeteer

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36"
  ];
  await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

  try {
    // Sayfayı aç ve tam yüklenmesini bekle
    await page.goto('https://www.yeniakit.com.tr/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // İçerik tamamen yüklenene kadar sayfayı aşağı kaydırmaya devam et
    const autoScroll = async () => {
      let previousHeight;
      while (true) {
        previousHeight = await page.evaluate('document.body.scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        
        // 2 saniye bekleme
        await new Promise(resolve => setTimeout(resolve, 2000));

        const newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === previousHeight) break; // İçerik yüklemesi tamamlandıysa döngüden çık
      }
    };

    await autoScroll();

    // Haberleri çek
    const haberler = await page.evaluate(() => {
      const haberMap = new Map();
      const slides = document.querySelectorAll('.swiper-slide');

      slides.forEach((slide) => {
        const linkElement = slide.querySelector('a');
        
        if (linkElement) {
          const title = linkElement.getAttribute('title');
          const href = linkElement.getAttribute('href');
          
          // href "#" veya title "Manşetlerin devamı" değilse benzersiz listeye ekle
          if (title && href && href !== "#" && href !== "#surmanset2" && title !== "Manşetlerin devamı" && title !== "Sürmanşetlerin Devamı") {
            const uniqueKey = `${title}-${href}`;
            if (!haberMap.has(uniqueKey)) {
              haberMap.set(uniqueKey, { title, href });
            }
          }
        }
      });
      return Array.from(haberMap.values());
    });

    // Haberleri JSON dosyasına kaydet
    if (haberler.length > 0) {
      fs.writeFileSync('haber/haberler_3.json', JSON.stringify(haberler, null, 2));
      console.log('Haberler haberler_3.json dosyasına kaydedildi.');
    } else {
      console.log('Haberler bulunamadı, lütfen selectoru kontrol edin.');
    }

  } catch (error) {
    console.error('Scraping işlemi sırasında hata oluştu:', error);
  } finally {
    await browser.close();
  }
})();
