@echo off
set PGPASSWORD=Sifre123!
cd /d "%~dp0"

echo Yedek Aliniyor...
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -h localhost -d takip_db -f yedek.sql

if %ERRORLEVEL% NEQ 0 (
  echo HATA: pg_dump bulunamadi veya baglanti kurulamadi.
  echo Lutfen PostgreSQL surumunu kontrol edin (16 ise path degistirin).
  echo Alternatif: C:\Program Files\PostgreSQL\16\bin\pg_dump.exe
  pause
  exit /b
)

echo Yedekleme Basarili: yedek.sql
echo Bu dosyayi yeni sunucuya tasiyabilirsiniz.
pause
