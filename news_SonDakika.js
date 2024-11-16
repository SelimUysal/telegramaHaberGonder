const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const randomDelay = (min = 1000, max = 3000) => Math.floor(Math.random() * (max - min + 1) + min);
const userAgents = [
  // Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko", // IE 11
  "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)", // IE 9
  "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0",

  // macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",

  // Linux
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",

  // Android
  "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; U; Android 4.0.4; en-us; GT-I9300 Build/IMM76D) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30",

  // iOS
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 13_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.4 Mobile/15E148 Safari/605.1.15"
];

const openPageAndScrape = async (instanceNumber) => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-notifications'
    ],
    slowMo: randomDelay(50, 100)
  });
  const closePagesIfNeeded = async (pages, instanceNumber) => {
    const message = `Instance ${instanceNumber}: Closed.`;
   
    
    // Koşullu olarak sayfaları kapatma
    if (message.includes("Closed")) {
        console.log(message);
        for (const page of pages) {
            await page.close();
        }
        console.log("Tüm sekmeler kapatıldı.");
    }
};

  const page = await browser.newPage();
  await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
  const url = 'https://www.sondakika.com/';

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`Instance ${instanceNumber}: Page loaded successfully.`);
  } catch (error) {
    console.error(`Instance ${instanceNumber}: Page load error:`, error);
    await browser.close();
    return;
  }

  try {
    // Debug modunu sürekli kontrol et
   /* const debugCheckInterval = setInterval(async () => {
      if (process.env.DEBUG) {
        console.log(`Instance ${instanceNumber}: Debug mode detected. Closing...`);
        await browser.close();
        clearInterval(debugCheckInterval);
      } else {
        console.log(`Instance ${instanceNumber}: Running normally.`);
      }
    }, 10000);*/

    // Diğer işlemler (Örnek olarak çerez onayı, reklam kapatma vb.)
    // Bildirim onayını kabul et
try {
    await page.waitForSelector('#popup-allow', { timeout: 5000 });
    await page.click('#popup-allow');
    console.log('Bildirim onayı verildi.');
} catch (error) {
    console.log('Bildirim onayı butonu bulunamadı:', error);
}

// Reklamı kapat
try {
    await page.waitForSelector('#closeBtn > img', { timeout: 5000 });
    await page.click('#closeBtn > img');
    console.log('Reklam kapatıldı.');
} catch (error) {
    console.log('Reklam kapatma butonu bulunamadı:', error);
}

 // Çerez onayını kabul et
 try {
    await page.waitForSelector('#cconsent-bar > div > div.ccb__right > div > button.consent-give', { timeout: 5000 });
    await page.click('#cconsent-bar > div > div.ccb__right > div > button.consent-give');
    console.log('Çerez onayı verildi.');
} catch (error) {
    console.log('Çerez onayı butonu bulunamadı:', error);
}


  // Sayfayı kaydırarak içeriğin yüklenmesini sağla
  await page.evaluate(async () => {
    const scrollDelay = 1000;
    for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }
});





      // Sayfayı otomatik kaydırma fonksiyonu
      const autoScrollDown = async () => {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    // Eğer sayfanın en altına ulaşıldıysa
                    if (window.scrollY + window.innerHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100); // 0.1 saniyede bir kaydırma
            });
        });
    };

    // Sayfayı aşağı kaydır
    await autoScrollDown();

    // Sayfayı otomatik yukarı kaydırma fonksiyonu
    const autoScrollUp = async () => {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                const distance = 100;
                const timer = setInterval(() => {
                    window.scrollBy(0, -distance);
                    // Eğer sayfanın en üstüne ulaşıldıysa
                    if (window.scrollY === 0) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100); // 0.1 saniyede bir kaydırma
            });
        });
    };

    // Sayfayı yukarı kaydır
    await autoScrollUp();

    // Fare hareketi yapma
    const mouseMove = async (x, y) => {
        await page.mouse.move(x, y);
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 saniye bekle
    };

    // Sayfanın ortasına fareyi hareket ettir
    await mouseMove(800, 600); // Koordinatları ihtiyacınıza göre ayarlayın
    await mouseMove(1800, 1600); // Koordinatları ihtiyacınıza göre ayarlayın
    await mouseMove(100, 200); // Koordinatları ihtiyacınıza göre ayarlayın
    await mouseMove(1800, 900); // Koordinatları ihtiyacınıza göre ayarlayın


// Haberleri kaydetme fonksiyonu
/* 
const saveNewsToFolder = (instanceNumber, haberler) => {
  const folderPath = path.join(__dirname, 'haber'); // 'haber' klasörüne kaydet

  // Klasör yoksa oluştur
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  const filePath = path.join(folderPath, `haberler_${instanceNumber}.json`);
  fs.writeFileSync(filePath, JSON.stringify(haberler, null, 4));
  console.log(`Instance ${instanceNumber}: News saved to ${filePath}`);
}; 

*/



// Haberleri kaydetme fonksiyonu
const saveNewsToFolder = (instanceNumber, haberler) => {
  const folderPath = path.join(__dirname, 'haber'); // 'haber' klasörüne kaydet

  // 'haber' klasörü yoksa oluştur
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  // Instance dosyasına yaz
  const filePath = path.join(folderPath, `haberler_${instanceNumber}.json`);
  fs.writeFileSync(filePath, JSON.stringify(haberler, null, 4));
  console.log(`Instance ${instanceNumber}: News saved to ${filePath}`);

  // 'Today News' klasörünü oluştur
  const todayNewsFolderPath = path.join(__dirname, 'Today News');
  if (!fs.existsSync(todayNewsFolderPath)) {
    fs.mkdirSync(todayNewsFolderPath);
  }

  // Günlük tarih formatını al (örneğin, '11.11.2024.json')
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const todayDateFileName = `${day}.${month}.${year}.json`;
  const todayNewsPath = path.join(todayNewsFolderPath, todayDateFileName);

  // Mevcut günlük dosyasını oku veya boş bir dizi başlat
  let existingNews = [];
  if (fs.existsSync(todayNewsPath)) {
    const data = fs.readFileSync(todayNewsPath, 'utf8');
    existingNews = data ? JSON.parse(data) : [];
  }

  // Haberlerin tekrarını kontrol eden bir fonksiyon
  const isNewsDuplicate = (newsItem) => {
    return existingNews.some(
      (existingItem) =>
        existingItem.title === newsItem.title && existingItem.href === newsItem.href
    );
  };

  // Null title veya link içerenleri filtrele ve tekrarları engelle
  const filteredNews = haberler.filter(
    (newsItem) =>
      newsItem.title && newsItem.href && !isNewsDuplicate(newsItem)
  );

  // Yeni haberleri mevcut listeye ekle
  existingNews = existingNews.concat(filteredNews);

  // Güncellenmiş listeyi günlük dosyaya yaz
  fs.writeFileSync(todayNewsPath, JSON.stringify(existingNews, null, 4));
  console.log(`Instance ${instanceNumber}: News appended to ${todayDateFileName}`);
};





    // Haber çekme işlemleri, JSON dosyasına kaydetme, fare hareketi vb. işlemler
    const haberler = await page.evaluate(() => {
      const haberListesi = [];
    
      // Manşet haberini ekle
    /*  const mansetLink = document.querySelector('#manset1 > a');
      if (mansetLink) {
        haberListesi.push({
          title: mansetLink.getAttribute('title') || null,
          href: mansetLink.href || null,
          imgSrc: mansetLink.querySelector('img') ? mansetLink.querySelector('img').src : null
        });
      } */
        console.log("manşet haber yüklenmeycek.");

      // Diğer haberleri ekle
      document.querySelectorAll('li[id^="manset"] a').forEach(linkTag => {
        const title = linkTag.getAttribute('title') || null;
      
        // Eğer başlık "BMI" içeriyorsa listeye ekleme
        if (title && title.toLowerCase().includes('bmi')) {
          return; // Bu başlığı atla
        }
      
        haberListesi.push({
          title: title,
          href: linkTag.href || null,
          imgSrc: linkTag.querySelector('img') 
            ? (linkTag.querySelector('img').getAttribute('data-src') || linkTag.querySelector('img').src)
            : null
        });
      });
    
      return haberListesi;
    });
    console.log(`Instance ${instanceNumber}: Extracted news count: ${haberler.length}`);


    //fs.writeFileSync(`haberler_${instanceNumber}.json`, JSON.stringify(haberler, null, 4));
   // console.log(`Instance ${instanceNumber}: News saved to haberler_${instanceNumber}.json`);

   if (haberler.length > 0) {
    saveNewsToFolder(instanceNumber, haberler);
  } else {
    console.log(`Instance ${instanceNumber}: No news found.`);
  }

  } catch (error) {
    console.error(`Instance ${instanceNumber}: Error during scraping:`, error);
  } finally {
    await browser.close();
    console.log(`Instance ${instanceNumber}: Closed.`);
  }

};

// Aynı anda  farklı tarayıcı başlatma
(async () => {
  const instances = 1;
  const tasks = [];
  
  for (let i = 1; i <= instances; i++) {
    tasks.push(openPageAndScrape(i));
  }
  
  await Promise.all(tasks);
  console.log("All instances finished.");
})();