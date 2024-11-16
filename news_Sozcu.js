const axios = require('axios');  // HTTP isteği yapmak için
const cheerio = require('cheerio');  // HTML parse etmek için
const fs = require('fs');  // Dosya işlemleri için
const path = require('path');  // Yol işlemleri için

// Verdiğiniz URL'yi burada belirtin
const url = 'https://www.sozcu.com.tr/';

async function getNews() {
    try {
      // Web sayfasını çekme
      const { data } = await axios.get(url);
      
      // HTML'i cheerio ile parse etme
      const $ = cheerio.load(data);
      
      // CSS selector kullanarak haberlerin href ve alt başlık bilgilerini çekme
      const newsItems = [];
      
      $('.swiper-slide a').each((index, element) => {
        // Her bir haberin href bilgisini çekiyoruz
        const href = $(element).attr('href');
        
        // Eğer href 'https://' ile başlamıyorsa, başına temel URL'yi ekliyoruz
        const fullUrl = href.startsWith('https://') ? href : `https://www.sozcu.com.tr${href}`;
        
        // Eğer bir <img> etiketi varsa, alt metni alıyoruz
        const title = $(element).find('img').attr('alt');
        
        // Verileri diziye ekliyoruz
        newsItems.push({ href: fullUrl, title });
      });

      // "haber" klasörünün var olup olmadığını kontrol et
      const dirPath = path.join(__dirname, 'haber');
      if (!fs.existsSync(dirPath)) {
        // Eğer klasör yoksa, oluşturuyoruz
        fs.mkdirSync(dirPath);
      }

      // JSON formatında haber verilerini dosyaya kaydetme
      const filePath = path.join(dirPath, 'haberler_2.json');
      fs.writeFile(filePath, JSON.stringify(newsItems, null, 2), (err) => {
        if (err) {
          console.error('Dosya kaydedilemedi:', err);
        } else {
          console.log('Haber verileri başarıyla haberler_2.json dosyasına kaydedildi.');
        }
      });

    } catch (error) {
      console.error('Hata oluştu:', error);
    }
}

getNews();
