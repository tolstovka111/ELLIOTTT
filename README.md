# Dельта VPN

Android-клиент VPN на VLESS/Xray с двумя точками входа: **serverless** (Cloudflare
Worker) и **VPS** (VLESS + XTLS-Reality). Интерфейс — в стиле референса SotaVPN,
но в чёрно-бело-синей гамме, с логотипом-квадратом из исходного изображения.

```
android/            приложение (Kotlin, Jetpack Compose, VpnService)
serverless/worker/  Cloudflare Worker: VLESS-over-WebSocket + выдача подписки
server/             установщик узла на VPS (Xray + Reality)
scripts/            генерация иконок, загрузка нативного ядра
docs/               инструкции по настройке
```

## Как это устроено

```
Приложение ──► TUN ──► tun2socks ──► SOCKS 127.0.0.1:10808 ──► Xray-core
                                                                  │
                          ┌───────────────────────────────────────┴───────┐
                          ▼                                               ▼
             Cloudflare Worker (WS+TLS)                        VPS (VLESS + Reality)
             адреса Cloudflare, без своего IP                  свой IP, маскировка под TLS
```

* **Serverless-узел.** Worker сам открывает исходящее TCP-соединение с целевым
  сайтом (`cloudflare:sockets`), то есть выходной точкой служит сама сеть
  Cloudflare — своего сервера в этом пути нет. Клиент подключается к anycast-адресам
  Cloudflare, а не к конкретному IP, который можно заблокировать.
* **VPS-узел.** VLESS + XTLS-Reality: соединение неотличимо от обычного TLS к
  популярному сайту, своего сертификата нет. Это лучший вариант по скорости и
  устойчивости к DPI, пока IP сервера не заблокирован.
* Приложение хранит оба узла, меряет TCP-пинг и само выбирает «Лучший сервер».

## Быстрый старт

```bash
# 1. Узел на VPS (Ubuntu/Debian/RHEL, от root)
scp server/install-xray-reality.sh root@ВАШ_IP:/root/
ssh root@ВАШ_IP '/root/install-xray-reality.sh --name "Dельта · DE"'
# скрипт напечатает vless://… ссылку

# 2. Serverless-узел
cd serverless/worker
npm install
npx wrangler secret put UUID        # тот же UUID, что и на VPS, либо новый
npx wrangler secret put SUB_TOKEN   # пароль для /sub
npx wrangler deploy

# 3. Приложение
./scripts/fetch-vpn-core.sh         # подтянуть Xray-ядро и tun2socks
cd android && ./gradlew assembleDebug
```

Подробности — в [docs/SETUP.md](docs/SETUP.md).

## Что нужно от вас

| Нужно | Зачем |
|---|---|
| VPS с публичным IP (1 vCPU / 1 ГБ хватает) | узел с Reality; подойдёт любой, включая уже имеющийся |
| Аккаунт Cloudflare (бесплатный) | serverless-узел и раздача подписки |
| Домен (опционально) | свой адрес вместо `*.workers.dev`, который в РФ часто фильтруют |
| Ключ подписи (для релиза) | публикация APK вне Google Play |

## Сборка APK

CI (`.github/workflows/android.yml`) собирает debug-APK на каждый push и кладёт его
в артефакты сборки. Локально нужен Android SDK 35 и JDK 17.

Без нативного ядра приложение собирается и запускается в **демо-режиме**: весь
интерфейс работает, туннель поднимается, но трафик через него не идёт. Как
подключить ядро — [docs/VPN-CORE.md](docs/VPN-CORE.md).

## Тесты

```bash
cd serverless/worker && npm test     # парсер VLESS-заголовков
cd android && ./gradlew test         # генератор конфигурации Xray
```

## Правовая заметка

Проект предназначен для доступа к открытым источникам информации. Распространение
средств обхода блокировок в РФ регулируется отдельно, а магазины приложений
(в частности Google Play) предъявляют свои требования к VPN-приложениям —
это стоит учитывать до публикации.
