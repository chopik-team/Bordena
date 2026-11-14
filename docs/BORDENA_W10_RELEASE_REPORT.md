# Bordena W 1.0 — релизный отчёт

Дата отчёта: 11.11.2026; дополнено 14.11.2026. Машинная версия: **1.0.0**. Пользовательская версия: **Bordena W 1.0**.

**BUILD READY — PASS (локально и удалённый CI). RELEASE CANDIDATE READY — PARTIAL (локальный подписанный комплект проверен; обязательные внешние проверки не закрыты). PUBLIC RELEASED — PENDING.** Необходимые чистые Windows 10/11 и публичный GitHub Release download пока не подтверждены. Это не заявление о состоявшемся публичном релизе.

## Изменения

- Версии приложения, приватных пакетов, Cargo, руководства, About и генераторов согласованы. Display version и release channel отделены от SemVer; сравнение обновлений выполняется SemVer.
- История RU/EN использует W/AW без дат в заголовках: 0.8.2 → AW 0.82, 0.8.1 → AW 0.81, 0.8.0 → AW 0.8, 0.7.1 → AW 0.71 и ранее. Полное соответствие — `releases/version-history.json`. Исходные changelog сохранены в `releases/CHANGELOG-before-W1.0.md` и EN. Старые архивы, SHA и Git-теги не переписаны.
- В Free Layout постоянно видна кнопка «+ Добавить столбец» слева под шапкой. Она использует существующий `useLayoutChange` и структурную историю, создаёт только столбец, поддерживает клавиатуру и Undo/Redo. Модель требует минимум один столбец; ради нулевого состояния схема не менялась.
- Основная модель не изменялась: identifier `team.chopik.bordena`, IndexedDB v15, JSON v6, существующие сервисы досок/календаря/backup. Новая база или миграция не создавались.
- NSIS регистрирует InstallPath/Version/ProductId/Channel. Отключены downgrade и принудительное завершение приложения при silent update; общий mutex защищает установку и удаление. Launcher использует штатный `/UPDATE` при обновлении. Версия повторно сверяется под mutex перед копированием, чтобы закрыть окно между первоначальной проверкой и началом установки. WebView2 — штатный downloadBootstrapper при отсутствии runtime; обычная работа остаётся офлайн.
- `Bordena.bat` указывает на комплект W 1.0, без автоматического перехода к dev. `dev.bat` сохранён.

## Доставка и Launcher

Официальный репозиторий создан по решению владельца: [chopik-team/Bordena](https://github.com/chopik-team/Bordena). Очищенные исходники опубликованы в `main`; исходная рабочая Git-история сохранена отдельно. Публичного бинарного Release пока нет. Не публиковалась фиктивная Stable 1.0.1. Источник доставки закреплён как GitHub Releases этого репозитория.

В CHOPIK Launcher расширены существующие `InstallationControls`, bridge и registry. Добавлен native `product_delivery.rs`: автоматическая проверка по имеющейся настройке auto-check; кнопки установки/обновления, прогресс и notes. Актуальная версия приходит из проверенной metadata, не зашита в UI. Stable и Dev сохраняют отдельные привязки. Удалённая установка предлагает reinstall; действующая portable-привязка остаётся запускаемой, но управляемое обновление требует официальной регистрации NSIS.

Криптографически подписаны точные JSON metadata и установщик; обе подписи связаны с машинной версией. Native policy проверяет HTTPS/репозиторий/разрешённые CDN redirects, identity, Stable, Windows x64, размер, SHA-256 и подписи. Предыдущая версия программных файлов сохраняется с проверкой readback. Успех объявляется после реального завершения NSIS и проверки регистрации/версии/пути. Данные каталога не могут задавать shell, команды, локальные пути и аргументы.

В Bordena не добавлялся второй updater. Отдельный встроенный self-updater Launcher не используется для подмены продукта. Тестовый локальный HTTPS transport и команда установки fixture доступны только сборке `qa` с отдельным identifier; production их исключает.

Native staging подтвердил **0.8.2 → 1.0.0 → 1.0.1** через реальную загрузку, проверку и NSIS, без пересборки Launcher между версиями. Отдельно через настоящие кнопки карточки проверен случай «не установлено → установить W 1.0». После uninstall проверены существующие данные и прямая reinstall. Windows Start-menu shortcut, Publisher CHOPIK Team и версия 1.0.0 подтверждены.

Это локально проверенная интеграция. Публичная доставка самого обновлённого Launcher и скачивание Bordena из реально опубликованного Release ещё не объявляются завершёнными.

## Сохранность и QA

Перед работой сохранены source baseline обоих проектов и полный комплект AW 0.82. Исходный EXE SHA-256: `a22360d5cff3e9c69aa8d591a573474203ab8f2ccc27d86e733849aee528a826`. Patch проверен обратным применением в отдельном index; рабочий index/HEAD не заменялись.

В оригинальную AW 0.82 через настоящий Windows file picker импортирована богатая QA-фикстура: 6 досок, 1007 карточек, 15 секций, 2 вложения, календари/повторения/Goal Path/связи/правила. Через настоящий Save dialog создана и после записи проверена внешняя ZIP-копия. Все IDB stores и байты вложений/backup сверены по содержимому после обоих обновлений и повторных запусков. Исключён только внутренний `bordena:lock-generation`, который штатно меняется при каждом старте и не является пользовательскими данными. Настройки совпали. Реальные профили пользователя не использовались.

Пройдено: **684 JS/TS**, **3 Rust Bordena**, 13 typecheck и 8 lint tasks, 796 переводимых literal keys. Launcher: **66 frontend / 41 Rust tests**. Native проверки подтверждают EXE/BAT, About/history, пустую/3/5-column доску, Enter/Undo/Redo, 640–1920 px, прокрутку, RU/EN, Light/Dark, Compact/Focus и годовой обзор.

Проверены отказы: подмена metadata, неправильные подпись/хэш/размер/архитектура, HTTP error, обрыв, offline, повторное обновление, более старая версия, запущенная Bordena и controlled installer exit 7. Silent NSIS самостоятельно отказался заменять работающий EXE и не завершил процесс. Предыдущие файлы после отказов остались пригодны; recovery snapshot сохранён. Автоматический транзакционный rollback всего реестра Windows не заявляется.

Исправления, найденные проверками: передача последнего NSIS `/D=` без кавычек для путей с пробелами; состояние reinstall после удаления; проверка существующей unregistered привязки и запущенных известных Stable/Dev установок. Ошибки тестовых селекторов/формата Channel и времени создания QA-профиля исправлены в тестовом окружении; продуктовые даты не менялись.

Дополнительные native installer проверки PASS: настоящий NSIS возвращает 1618 при занятом named mutex; silent uninstaller не удаляет файлы под тем же mutex. При искусственно повышенной версии в отдельной QA-регистрации post-lock проверка возвращает 1638, оставляя EXE без изменений; после восстановления реальной регистрации тот же пакет корректно обновляет 1.0.0 → 1.0.1.

## Очистка и ресурсы

Удалены 10 сгенерированных `.tools/_082-*.mjs` — преобразованные копии сохранённых оригинальных e2e-скриптов, а также два неиспользуемых upstream-файла `apps/client/Dockerfile` и `nginx.conf`, описывавшие серверные `/api`/OAuth/MCP маршруты. Проверено отсутствие ссылок на них в Windows build/workflow. Для обеих групп ZIP прочитан повторно и каждый SHA-256 сверен. Остальные QA-профили, исходники, лицензии, инструменты и старые артефакты не удалялись. После очистки выполнена полная Windows-сборка.

Для публичного снимка отдельно установлены все 932 зависимости из локального кэша по frozen lockfile; выполнены 13 typecheck tasks, frontend build и полная сборка EXE/NSIS с новым Cargo target. EXE этого снимка прошёл native QA и включён в финальный локальный комплект. Утилиты сборки использовались как build-time toolchain/cache; каталоги пользовательских профилей и CHOPIK assets не требовались для работы приложения.

По дополнительному запросу разобраны три старые папки в корне C: с QA AW 0.3, загруженными установочными пакетами SDK/MSVC и неиспользуемым upstream-кодом. Все 11 340 файлов упакованы и проверены SHA-256; 144 ссылки сохранены как метаданные без обхода целей. Три исходные папки удалены, проверенные ZIP находятся в `archives/legacy`, исключены из Git и релизного комплекта. Объём уменьшен примерно на 596.7 МиБ. В текущих зависимостях и toolchain проверены 3274 ссылки — обращений к старым папкам нет. После очистки полная Windows-сборка повторена. Подробности — локальный `BORDENA_LEGACY_CLEANUP_REPORT.md`.

В `C:\CHOPIK assets` скопированы утверждённый PNG, `tokens.css`, `theme.css` и универсальный `cn.ts`. У каждого ресурса записаны происхождение, авторство, лицензия, версия, технология, зависимости, применение и SHA-256. Прежние файлы библиотеки не заменялись неизвестными данными; обязательной runtime-зависимости нет.

## Лицензии и подписи

Сохранены Doska / **Margarita Romenkova / MIT**, copyright Станислава Смирнова, README, About, NOTICE, frontend/Rust notices, OFL шрифтов и исходники обнаруженных MPL crate. Официальный [MIT Doska](https://github.com/romenkova/doska/blob/main/LICENSE) указан без заявления об авторстве всего upstream-кода CHOPIK Team. Утверждённый пользователем логотип сохранён; его брендинг не объявлен автоматически MIT.

Долговременный ключ подписи доставки защищён Windows DPAPI вне проекта; в исходниках/артефактах только публичный ключ. Частный ключ не публиковался. Нужны защищённый backup владельца и настройка GitHub signing secrets для другого build host. Подпись пакета и Authenticode различаются; см. [Tauri updater](https://v2.tauri.app/plugin/updater/) и [Windows installer](https://v2.tauri.app/distribute/windows-installer/).

**Windows Authenticode не настроен**: доступных сертификатов текущего пользователя для code signing нет. Возможен SmartScreen. Installer Publisher в реестре — метаданные, а не заверенная цифровая подпись.

## Комплекты и оставшиеся условия

Основной локальный комплект: `C:\Bordena\artifacts\Bordena-W1.0-Windows-x64\` — Bordena.exe, Setup.exe, подписи, metadata, лицензии, MPL sources, VERSION.json, SHA256SUMS и release notes. Запуск — `C:\Bordena\Bordena.bat`. Историческая 1.0.1 находится только в изолированных `.tools/qa-*`.

Launcher integration candidate: `C:\CHOPIK Launcher\artifacts\CHOPIK-Launcher-AW0.5-Bordena-W1.0-integration\`. Его техническая версия остаётся 0.5.0; это локальная интеграционная сборка, не опубликованное обновление Launcher.

До публичного Stable обязательны: clean Windows 10/11, WebView2-absent install, управляемые disk-full/OS interruption проверки, загрузка и сверка фактического GitHub installer/metadata, CI на удалённом runner и защищённые release secrets. Проверка на существующей Windows 11 с runtime не заменяет чистые ОС. Полный список статусов — [release checklist](BORDENA_W10_RELEASE_CHECKLIST.md).

GitHub Actions workflow расширен без второго CI: фиксированные версии инструментов, пять официальных Actions закреплены проверенными commit SHA, dependency fetch перед offline license audit, проверки, NSIS и optional signing. Исторический run 43100550434 завершился FAIL на pnpm test: locale-dependent assertion и native fs.watch assertion. Полный старый журнал сохранён в `.tools/w10-ci-failure.log`; исправления и новый run описаны ниже.

Рабочая Git-история Doska не перезаписана; upstream оставлен read-only, origin указывает на утверждённый репозиторий. Публичный снимок исключает локальные профили, ключи, инструменты, большие сборки и внутренние личные отчёты. Воспроизводимость и реальная публикация исходников фиксируются в `evidence/w10-public-source.json` и `evidence/w10-github-publication.json`. Native integration regression сохранена в Launcher `scripts/test-bordena-w10-delivery.mjs` и `scripts/test-bordena-w10-uninstall.mjs`; staging-фикстуры остаются локальными. Публичный бинарный Release не создаётся, пока обязательные условия не закрыты.

## Финальное закрытие блокеров — 14.11.2026

**Локализация — PASS локально и на GitHub.** Тест move-card-to-board параметризован для явно
выбранных ru → «Задачи» и en → «Tasks»; после теста возвращается system. Проверяются
те же стабильные ID, данные и вложения. Язык ОС/всего CI не менялся. Отдельный файл:
5 tests PASS; полный core: 259 PASS. Продуктовая логика не изменялась.

**fs.watch — PASS локально и на GitHub.** Причина воспроизведена на той же Node 24.19.0 /
libuv 1.52.1: native watcher на Windows-пути 8.3 аварийно завершился с 3221226505
и тем же fs-event.c:72, на полном пути прошёл. Связанный upstream:
[libuv issue 5010](https://github.com/libuv/libuv/issues/5010),
[исправление 5152](https://github.com/libuv/libuv/pull/5152).
В Node-адаптере integration-test перед fs.watch применяется realpathSync.native.
Все watcher handles отслеживаются; cleanup ждёт событие close перед удалением
временного каталога даже при неуспешном тесте. Watcher-test ждёт завершённое
изменение доски, а не только появление первой записи. Проверен единственный
watcher в исходном сценарии; разные файлы Vitest имеют отдельные процессы и
уникальные mkdtemp-каталоги. Параллелизм полного набора сохранён, retries и
подавление native abort не добавлялись, runtime не менялся. Полный vault
integration-suite (13 tests) прошёл 10 отдельных процессов с TEMP/TMP в реальном
8.3-пути: 130/130 PASS. Доказательства — w10-fs-watch-reproduction.json и
w10-fs-watch-repeat.json в evidence.

**Локальная регрессия — PASS:** 685 JS/TS, 3 Rust tests, 13 typecheck и 8 lint tasks.
В workflow добавлены RU/EN regression и пять обязательных повторов полного vault
integration-suite; первая ошибка останавливает workflow. Это повторные измерения,
а не попытки получить случайный PASS.

**Удалённый CI — PASS:**
[43630992150](https://github.com/chopik-team/Bordena/actions/runs/43630992150),
commit `58ae23f4fa693dc39ee8868fbc7016d5236d5600`. Полностью завершились проверки
версии/i18n, typecheck, lint, RU/EN, пять vault suite runs, весь pnpm test,
Rust tests, license audit, release EXE/NSIS и upload-artifact.
Artifact `bordena-windows-candidate` (ID 14128516893) реально скачан через GitHub
API: 8 392 336 байт, ZIP SHA-256
`5f50d3493346b35745ca8a79f7a83d24cdf2686bf89fbe203d181181e7f116a4`
совпал с GitHub digest. Все 62 распакованных файла сверены с ZIP по SHA-256;
EXE и NSIS имеют FileVersion 1.0.0 / ProductName Bordena, лицензии Doska/MIT и
уведомления включены. Полученный EXE, а не прежняя локальная копия, прошёл native
embedded QA в отдельном .tools/qa-* профиле: W 1.0, RU/EN, light/dark,
Compact/Focus, Undo/Redo и сохранение ID столбца, 640–1920px, годовой календарь;
внешних app requests/errors нет, новые скриншоты не создавались.
Это скачивание Actions artifact, а не публичных Release assets.
Лог (175 927 байт) проверен на конкретную credential строку и признаки
приватных ключей/GitHub tokens: не обнаружены. Доказательства —
evidence/w10-final-ci.json и w10-final-ci-native.json; исходный лог —
локальный .tools/w10-ci-success-132557323707.log.
CI signing-step штатно пропущен на push; remote candidate не подписан и не
подменяет прежний локальный подписанный комплект. Исходники приложения между
его commit 58760bf и CI commit 58ae23f не менялись: только тесты и workflow.
Исходные предупреждения nested-button в UI-тесте, bundle size и deprecated
Node20 Actions runtime не маскировались; они не вызвали failure и сохранены
в полном логе. Вне минимального исправления release blockers UI не переделывался.

**Отмена NSIS — PASS:** Escape на welcome-page настоящего QA installer до
копирования файлов, exit 1. SHA-256 всех 76 программных файлов и 246 файлов
QA-профиля не изменились; окно установщика закрылось. Доказательство:
evidence/w10-installer-cancel.json. Это не тест прерывания посреди установки.

**Чистые ОС / WebView2 / аварийное восстановление — PENDING.** Доступна существующая
Windows 11 Pro 10.0.26300 с Runtime. Установленных Hyper-V/VBox/VMware-инструментов,
VM services и предоставленных чистых Windows VM не обнаружено. Основная машина
и её Runtime не изменялись. Протокол оставшихся проверок —
BORDENA_W10_CLEAN_WINDOWS_QA.md. Согласовано оставить небольшой Setup с
downloadBootstrapper: интернет нужен при отсутствии Runtime; дополнительный
offlineInstaller не добавляется. После установки приложение работает офлайн.

**Подпись CI — PENDING.** Read-only GitHub audit: secrets list пуст, environments
отсутствуют, protection main не настроен. Наличие условного signing-step не
означает защищённую конфигурацию. Существующий DPAPI-ключ не ротировался, не
выводился и на GitHub в этой итерации не передавался. До подписанного CI нужны
защищённое release environment с review/branch policy и безопасная загрузка
существующего ключа в environment secret. Windows Authenticode по-прежнему нет.
Локальные закреплённые подписи продолжают проверяться независимо от CI.

**GitHub Release / публичный Launcher — PENDING.** Stable v1.0.0 не создан из-за
открытых обязательных gates. Поэтому анонимное скачивание настоящих Release assets
и доставка этой версии публичным Launcher ещё не проверены. Существующая локальная
проверка 0.8.2 → 1.0.0 → staging 1.0.1 сохраняет силу; это не публичный выпуск.
Recovery snapshot — проверенная копия программных файлов; автоматический rollback
всего реестра не заявляется. Точный ручной сценарий — обновлённый WINDOWS_INSTALL.md;
оригинальная историческая инструкция сохранена в releases/.

Launcher повторно проверен 14.11: **66 frontend / 41 Rust tests PASS**.
Исходники Launcher в этой итерации не менялись; локальная production integration
сборка повторно проверяет подписи прежнего кандидата. Изменённые файлы Bordena:
три test/fixture-файла, существующий workflow и release/install документация.
До начала изменений создан replay-verified baseline
artifacts/Bordena-W1.0-before-final-blockers-20261114.*; рабочий HEAD и Git index
сохранены. Старые архивы, подписанные комплекты, лицензии и CHOPIK assets сохранены.
