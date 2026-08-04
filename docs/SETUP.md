# Настройка Dельта VPN

## 1. Узел на VPS (VLESS + XTLS-Reality)

Подойдёт любой VPS с публичным IPv4 — 1 vCPU и 1 ГБ памяти хватает на несколько
десятков пользователей. Важнее локация (Нидерланды, Германия, Финляндия, Швеция
дают лучший пинг из европейской части РФ) и то, чтобы IP не был из «грязного» пула.

```bash
scp server/install-xray-reality.sh root@IP:/root/
ssh root@IP
chmod +x install-xray-reality.sh
./install-xray-reality.sh --sni www.microsoft.com --port 443 --name "Dельта · DE"
```

Скрипт ставит Xray-core, генерирует UUID и пару ключей x25519, пишет конфиг,
включает BBR, открывает порт и печатает готовую ссылку `vless://…`. Она же
сохраняется в `/root/delta-node.txt`.

Про `--sni`: это сайт, под трафик к которому маскируется соединение. Он должен
поддерживать TLS 1.3 + HTTP/2, не быть заблокирован в РФ и не принадлежать вам.
Хорошие кандидаты: `www.microsoft.com`, `www.samsung.com`, `www.icloud.com`.

Проверка после установки:

```bash
systemctl status xray
journalctl -u xray -n 50 --no-pager
```

## 2. Serverless-узел (Cloudflare Worker)

```bash
cd serverless/worker
npm install
npx wrangler login

npx wrangler secret put UUID        # uuidgen; это «пароль» клиента
npx wrangler secret put SUB_TOKEN   # произвольная строка, защищает /sub

# опционально: отдавать в подписке ещё и VPS-узел
npx wrangler secret put EXTRA_NODES # вставьте vless://… из шага 1

npx wrangler deploy
```

После деплоя воркер доступен по `https://delta-vpn.<аккаунт>.workers.dev`:

* `wss://…/delta` — сам туннель (путь задаётся переменной `WS_PATH`);
* `https://…/sub?token=<SUB_TOKEN>` — подписка для приложения.

`*.workers.dev` в России часто фильтруется. Практичнее привязать свой домен:
в Cloudflare → Workers & Pages → ваш воркер → Settings → Domains & Routes →
Add Custom Domain. Тогда клиент ходит на обычный домен, а трафик всё равно
терминируется на edge-узлах Cloudflare.

## 3. Приложение

```bash
./scripts/fetch-vpn-core.sh              # libv2ray.aar + libtun2socks.so
cd android
./gradlew assembleDebug                  # app/build/outputs/apk/debug/
```

Требуется JDK 17 и Android SDK 35 (`sdkmanager "platforms;android-35" "build-tools;35.0.0"`).

Чтобы приложение сразу знало адрес подписки, пропишите его в
`android/app/build.gradle.kts`:

```kotlin
buildConfigField("String", "DEFAULT_SUBSCRIPTION_URL", "\"https://vpn.example.com/sub?token=…\"")
```

Иначе ссылка вставляется вручную: Настройки → Подписка → Обновить список серверов.

### Релизная сборка

```bash
keytool -genkey -v -keystore delta.jks -keyalg RSA -keysize 2048 -validity 10000 -alias delta

export DELTA_KEYSTORE=$PWD/delta.jks
export DELTA_KEYSTORE_PASSWORD=…
export DELTA_KEY_ALIAS=delta
export DELTA_KEY_PASSWORD=…

cd android && ./gradlew assembleRelease
```

## 4. Проверка

1. Установите APK, откройте приложение — на главном экране должен появиться узел.
2. Настройки → вставьте ссылку подписки → «Обновить список серверов».
3. Нажмите кнопку питания, подтвердите системный запрос VPN.
4. Статус меняется на «Подключено», идёт таймер, в шторке висит уведомление.
5. Проверьте выходной IP: откройте `https://ifconfig.me` — он должен отличаться от
   вашего. Для serverless-узла это будет адрес Cloudflare.

Если статус срывается в «Ошибка подключения», смотрите логи:

```bash
adb logcat -s DeltaVpnService XrayTunnelEngine Tun2SocksProcess
```

## Про обход белых списков — честно

* Пока работает «чёрный список» (блокируются конкретные ресурсы), и Reality, и
  Cloudflare-воркер справляются: трафик выглядит как обычный HTTPS.
* Когда включается **белый список** — разрешено только то, что явно разрешено, —
  выживает лишь тот вход, чей адрес попал в белый список. Cloudflare живёт дольше
  «своего» VPS, потому что на тех же адресах висят тысячи нужных стране сайтов и
  блокировать их целиком дорого. Но гарантии это не даёт: при жёстких режимах
  Cloudflare тоже деградирует.
* Поэтому и нужны оба типа узлов сразу: приложение автоматически выбирает тот,
  который отвечает быстрее, и переключается на второй, когда первый недоступен.
* Дополнительные меры на будущее: несколько воркеров на разных доменах, узлы у
  разных провайдеров, резервный порт 8443, домены-«зеркала» для подписки.
