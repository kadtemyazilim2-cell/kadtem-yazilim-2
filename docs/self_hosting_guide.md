# Takip Sistemi - Kendi Sunucunuzda (Local/On-Premise) Kurulum Rehberi

Bu rehber, yazılımı ve veritabanını ofisinizdeki bir Windows Sunucusu (veya güçlü bir PC) üzerine kurmanızı sağlar.

## Gereksinimler
- **İşletim Sistemi:** Windows 10/11 veya Windows Server 2019/2022
- **RAM:** Minimum 8GB (Önerilen 16GB)
- **Disk:** SSD (Performans için şarttır)

---

## 1. Gerekli Programların Kurulumu

### A. Node.js (Yazılımın Çalışması İçin)
1.  [Node.js İndir](https://nodejs.org/en) adresine gidin.
2.  **LTS (Long Term Support)** sürümünü indirin ve kurun.
3.  Kurulum bittikten sonra CMD (Komut İstemi) açıp `node -v` yazarak kontrol edin (Örn: v20.x.x yazmalı).

### B. PostgreSQL (Veritabanı İçin)
1.  [PostgreSQL İndir](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) adresinden Windows sürümünü indirin.
2.  Kurulum sırasında size bir **Superuser Password** (Şifre) soracaktır. Bunu unutmayın! (Örn: `Sifre123!`)
3.  Port numarasını **5432** olarak bırakın.
4.  Kurulum bitince **pgAdmin 4** programını açın (Postgres ile birlikte kurulur).
5.  Sol menüden sunucuya bağlanın (Şifrenizi girin).
6.  `Databases` üzerine sağ tıklayıp -> `Create` -> `Database`.
7.  İsim olarak `takip_db` yazın ve kaydedin.

---

## 2. Yazılımın Kurulumu

1.  Masaüstünde veya C: sürücüsünde `takip-sistemi` adında bir klasör oluşturun.
2.  Size gönderilen proje dosyalarını bu klasörün içine atın.
3.  O klasörün içinde boş bir yere sağ tıklayıp "Terminalde Aç" (veya CMD ile o klasöre gidin).

### A. Bağımlılıkları Yükleme
Terminalde şu komutu çalıştırın:
```bash
npm install
```
(Bu işlem internet hızınıza göre 1-5 dakika sürebilir).

### B. Ayar Dosyasını Düzenleme (.env)
Klasördeki `.env` dosyasını Not Defteri ile açın ve şu satırı kendinize göre düzenleyin:

```env
# Format: postgres://kullanici:sifre@localhost:5432/veritabani_adi
DATABASE_URL="postgres://postgres:Sifre123!@localhost:5432/takip_db"

# Güvenlik için Rastgele bir şifre (32+ karakter)
AUTH_SECRET="buraya_rastgele_cok_uzun_bir_yazi_yazin_guvenlik_icin"
```

### C. Veritabanını Hazırlama
Terminalde şu komutu çalıştırın. Bu komut, tabloları veritabanında oluşturur:
```bash
npx prisma db push
```
Eğer "🚀  Your database is now in sync with your Prisma schema." yazısını görürseniz işlem tamamdır.

---

## 3. Yazılımı Çalıştırma (Test)

Terminalde şu komutu yazın:
```bash
npm run dev
```
Biraz bekleyip tarayıcınızda `http://localhost:3000` adresine gidin. Giriş ekranını görüyorsanız her şey çalışıyor demektir!

---

## 4. Kalıcı Çalıştırma (Production)

Sunucu kapansa bile yazılımın otomatik açılması için:

1.  **Projeyi Derleyin (Build):**
    ```bash
    npm run build
    ```
    (Bu işlem 1-2 dakika sürer).

2.  **PM2 (Process Manager) Kurun:**
    ```bash
    npm install -g pm2
    ```

3.  **Başlatın:**
    ```bash
    pm2 start npm --name "takip-sistemi" -- start
    ```

4.  **Başlangıçta Otomatik Açılması İçin:**
    ```bash
    pm2 startup
    pm2 save
    ```

Artık adres: `http://localhost:3000`

---

## 5. Dışarıdan Erişim (Domain Yönlendirme)

Ofis dışından veya ağdaki diğer bilgisayarlardan `http://192.168.1.50:3000` gibi IP adresiyle erişebilirsiniz.
Eğer bir domain (örn: `takip.firmaniz.com`) kullanmak isterseniz, IIS (Internet Information Services) veya Nginx kurup, gelen istekleri `localhost:3000` portuna yönlendirmeniz gerekir (Reverse Proxy).

**Yedekleme:**
Veritabanınızı düzenli yedeklemek için `scripts/backup.bat` (hazırlanacak) dosyasını Windows Zamanlanmış Görevler'e ekleyebilirsiniz.
