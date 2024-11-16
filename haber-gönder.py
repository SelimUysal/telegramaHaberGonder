import json
import os
import requests
import time

# Kalıcı olarak saklamak için dosya yolu
sent_titles_file = 'sent_titles.txt'

# Gönderilen başlıkları dosyadan yükle
def load_sent_titles():
    if os.path.exists(sent_titles_file):
        with open(sent_titles_file, 'r', encoding='utf-8') as f:
            return set(f.read().splitlines())
    return set()

# Gönderilen başlıkları dosyaya yaz
def save_sent_title(title):
    with open(sent_titles_file, 'a', encoding='utf-8') as f:
        f.write(title + '\n')

# Gönderilen başlıklar
sent_titles = load_sent_titles()

# Telegram bot bilgileri
BOT_TOKEN = '7549860398:AAFCALej2OC6VBBWFmxmpm535Y7RPdWdxZk'
CHAT_ID = '-1002469042774'

json_directory = os.path.join(os.getcwd(), 'haber')

# Yeni başlık gönderilip gönderilmediğini kontrol etmek için bir değişken
new_titles_sent = False

# Haber dosyalarını kontrol et ve gönder
for instance_number in range(1, 5):
    json_file_path = os.path.join(json_directory, f'haberler_{instance_number}.json')
    
    if not os.path.exists(json_file_path):
        continue
    
    with open(json_file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
        
        if not data:
            continue
        
        for entry in data:
            title = entry.get('title')
            link = entry.get('href')
            
            if not title or not link:
                continue

            if title in sent_titles:
                continue

            sent_titles.add(title)
            save_sent_title(title)

            message = f"📰 {title} 📰 \n👁‍🗨👁‍🗨[Haberi oku]({link})✨✨"
            try:
                response = requests.post(
                    f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
                    data={'chat_id': CHAT_ID, 'text': message, 'parse_mode': 'Markdown'},
                    timeout=30,  # Zaman aşımı ekleniyor
                    verify=False  # Bypass SSL verification
                )

                if response.status_code == 200:
                    print(f"Başlık gönderildi: {title}")
                    new_titles_sent = True  # Yeni bir başlık gönderildi
                else:
                    print(f"Mesaj gönderilemedi (Hata kodu: {response.status_code}): {response.text}")
                    sent_titles.remove(title)  # Başarısız olursa başlığı kayıttan sil
            except requests.exceptions.RequestException as e:
                print(f"Mesaj gönderilirken hata oluştu: {e}")
                sent_titles.remove(title)  # Hata olursa başlığı kayıttan sil

            time.sleep(20)  # İstekler arası bekleme süresi 20 saniye

# Eğer hiç yeni başlık gönderilmediyse döngü sona erer, aksi takdirde 60 saniye bekler
if not new_titles_sent:
    print("Gönderilecek yeni haber bulunamadı, haber-gönder.py kapanıyor.")
else:
    print("Tüm haberler kontrol edildi, 60 saniye bekleniyor...")
    time.sleep(60)