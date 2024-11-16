/*  always 
const { spawn, exec } = require('child_process');

function kontrolVeCalistir() {
    console.log("news_Sozcu.js başlatılıyor...");
    const sozcuScraper = spawn('node', ['D:/proje/telegram/news_Sozcu.js'], {
        stdio: 'inherit' // Ana işlemle çıktıları paylaşır
    });

    sozcuScraper.on('close', (code) => {
        console.log(`news_Sozcu.js işlem tamamlandı (kod: ${code})`);

        console.log("news_Mashable.js başlatılıyor...");
        const mashableScraper = spawn('node', ['D:/proje/telegram/news_Mashable.js'], {
            stdio: 'inherit' // Ana işlemle çıktıları paylaşır
        });

        mashableScraper.on('close', (code) => {
            console.log(`news_Mashable.js işlem tamamlandı (kod: ${code})`);

            console.log("news_SonDakika.js başlatılıyor...");
            const sonDakikaScraper = spawn('node', ['D:/proje/telegram/news_SonDakika.js'], {
                stdio: 'inherit' // Ana işlemle çıktıları paylaşır
            });

            sonDakikaScraper.on('close', (code) => {
                console.log(`news_SonDakika.js işlem tamamlandı (kod: ${code})`);

                console.log("news_Akit.js başlatılıyor...");
                const akitScraper = spawn('node', ['D:/proje/telegram/news_Akit.js'], {
                    stdio: 'inherit' // Ana işlemle çıktıları paylaşır
                });

                akitScraper.on('close', (code) => {
                    console.log(`news_Akit.js işlem tamamlandı (kod: ${code})`);

                    console.log("haber-gönder.py işlemi kontrol ediliyor...");
                    exec('tasklist', (err, stdout, stderr) => {
                        if (err) {
                            console.error("İşlem listesi alınırken hata oluştu:", err);
                            return;
                        }

                        // Python işleminin çalışıp çalışmadığını kontrol et
                        if (stdout.includes('python.exe')) {
                            console.log("haber-gönder.py çalışıyor, durduruluyor...");
                            exec('taskkill /IM python.exe /F', (killErr) => {
                                if (killErr) {
                                    console.error("Python işlemi durdurulurken hata oluştu:", killErr);
                                } else {
                                    console.log("haber-gönder.py durduruldu, yeniden başlatılıyor...");
                                    baslatHaberGonderici();
                                }
                            });
                        } else {
                            console.log("haber-gönder.py çalışmıyor, başlatılıyor...");
                            baslatHaberGonderici();
                        }
                    });
                });
            });
        });
    });
}

function baslatHaberGonderici() {
    console.log("haber-gönder.py başlatılıyor...");
    const pythonProcess = spawn('python', ['D:/proje/telegram/haber-gönder.py'], {
        stdio: 'inherit' // Ana işlemle çıktıları paylaşır
    });

    // İşlem kapanırken bir kod al
    pythonProcess.on('close', (code) => {
        console.log(`haber-gönder.py işlem tamamlandı (kod: ${code})`);

        // Bütün işlemler tamamlandığında 20 dakika bekle
        console.log("Bütün işlemler tamamlandı. 20 dakika bekleniyor...");
        setTimeout(kontrolVeCalistir, 20 * 60 * 1000);  // 20 dakika bekle, sonra tekrar başlat
    });
}

// İlk işlemi hemen başlat
kontrolVeCalistir();

*/


const { spawn, exec } = require('child_process');

function kontrolVeCalistir() {
    console.log("news_Sozcu.js başlatılıyor...");
    const sozcuScraper = spawn('node', ['D:/proje/telegram/news_Sozcu.js'], {
        stdio: 'inherit'
    });

    sozcuScraper.on('close', (code) => {
        console.log(`news_Sozcu.js işlem tamamlandı (kod: ${code})`);

        console.log("news_Mashable.js başlatılıyor...");
        const mashableScraper = spawn('node', ['D:/proje/telegram/news_Mashable.js'], {
            stdio: 'inherit'
        });

        mashableScraper.on('close', (code) => {
            console.log(`news_Mashable.js işlem tamamlandı (kod: ${code})`);

            console.log("news_SonDakika.js başlatılıyor...");
            const sonDakikaScraper = spawn('node', ['D:/proje/telegram/news_SonDakika.js'], {
                stdio: 'inherit'
            });

            sonDakikaScraper.on('close', (code) => {
                console.log(`news_SonDakika.js işlem tamamlandı (kod: ${code})`);

                console.log("news_Akit.js başlatılıyor...");
                const akitScraper = spawn('node', ['D:/proje/telegram/news_Akit.js'], {
                    stdio: 'inherit'
                });

                akitScraper.on('close', (code) => {
                    console.log(`news_Akit.js işlem tamamlandı (kod: ${code})`);

                    console.log("haber-gönder.py başlatılıyor...");
                    baslatHaberGonderici();
                });
            });
        });
    });
}

function baslatHaberGonderici() {
    const pythonProcess = spawn('python', ['D:/proje/telegram/haber-gönder.py'], {
        stdio: 'inherit'
    });

    pythonProcess.on('close', (code) => {
        console.log(`haber-gönder.py işlem tamamlandı (kod: ${code})`);

        // Bütün işlemler tamamlandığında 20 dakika bekle
        console.log("Bütün işlemler tamamlandı. 20 dakika bekleniyor...");
        setTimeout(kontrolVeCalistir, 20 * 60 * 1000);  // 20 dakika bekle, sonra tekrar başlat
    });
}

// İlk işlemi hemen başlat
kontrolVeCalistir();