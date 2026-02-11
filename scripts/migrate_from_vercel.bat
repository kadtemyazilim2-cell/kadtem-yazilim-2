@echo off
set PGPASSWORD_LOCAL=Sifre123!
cd /d "%~dp0"

echo =================================
echo Vercel -> Local Veri Tasima Araci
echo =================================
echo.
echo ONEMLI: Lutfen Vercel veritabani baglanti adresini (POSTGRES_PRISMA_URL) hazir tutun.
echo (Eski .env dosyanizda yazan adres).
echo.
set /p REMOTE_URL="Vercel Baglanti Adresini Yapistirin: "

if "%REMOTE_URL%"=="" (
    echo Baglanti adresi girilmedi. Cikis yapiliyor.
    pause
    exit /b
)

echo.
echo 1. Vercel'den Veri Cekiliyor (Dump)...
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --dbname="%REMOTE_URL%" -f vercel_data.sql

if %ERRORLEVEL% NEQ 0 (
  echo HATA: Veri cekilemedi. Baglanti adresini kontrol edin.
  echo PostgreSQL surumunuz 17 degilse path'i duzenleyin.
  pause
  exit /b
)

echo.
echo 2. Yerel Veritabanina Yukleniyor...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d takip_db -f vercel_data.sql

if %ERRORLEVEL% NEQ 0 (
  echo HATA: Veri yuklenirken hata olustu.
  pause
  exit /b
)

echo.
echo ISLEM BASARILI! Tum veriler tasindi.
echo vercel_data.sql dosyasi yedek olarak saklandi.
pause
