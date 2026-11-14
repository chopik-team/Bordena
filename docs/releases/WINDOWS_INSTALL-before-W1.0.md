# Запуск и сборка Windows 10/11 x64

Bordena 0.7, package 0.7.0. Обычный запуск — **dev.bat** из `C:\Bordena`.
Скрипт проверяет локальные Node/pnpm/Rust/MSVC/SDK, пересобирает embedded debug exe
и открывает окно Tauri. Предыдущее окно нужно закрыть перед пересборкой.
Браузер, Vite-сервер и интернет в этом способе запуска не используются.

Инструменты находятся в `.tools` и не меняют системный PATH. Для новой машины
среду нужно подготовить заранее: Node 24.19.0, pnpm 11.25.0, Rust MSVC 1.99.1,
Microsoft C++ tools/SDK и WebView2 Runtime. В текущем workspace используются
VC 14.44.35207 и Windows SDK 10.0.26100.0. Они не входят в дистрибутив приложения.

```powershell
. ./scripts/native-env.ps1
pnpm install --offline --frozen-lockfile
pnpm check-env
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm e2e
pnpm --filter desktop build --debug --no-bundle
pnpm --filter desktop build --no-bundle
```

Debug exe: `apps/desktop/src-tauri/target/debug/bordena.exe`.
Release exe: `apps/desktop/src-tauri/target/release/bordena.exe`.
Для передачи на другую машину используйте комплект из artifacts с лицензиями,
а не отдельный executable. Релиз автоматически не публикуется.

Публичную версию берут Vite и Tauri из корневого package.json; Cargo и package
manifests синхронизированы с ней. Собственная идентичность: Bordena,
`team.chopik.bordena`, publisher CHOPIK Team. Обновление/установка не используют
идентификаторы и updater-конфигурацию Doska.

## Установщик

Конфигурация NSIS currentUser, RU/EN подготовлена. WebView2 installMode — skip:
установщик не должен скачивать runtime из интернета. Требуется уже установленный
Microsoft WebView2 Runtime или заранее подготовленная офлайн-установка runtime.

Исторический комплект 0.3 сохранён. Инструменты NSIS 3.11 и
nsis-tauri-utils 0.5.3 однократно получены Tauri bundler из официальных tauri-apps
GitHub releases; bundler проверил их хеши. `useLocalToolsDir: true` сохраняет их
в `apps/desktop/src-tauri/target/.tauri/`, без глобальной установки и правки PATH.
Rust-зависимости собираются с CARGO_NET_OFFLINE=true. Повторная сборка:
`pnpm build:windows`. Эти инструменты нужны только среде разработки, приложение
и установщик не скачивают WebView2 или облачные компоненты.

Комплект 0.4: `artifacts/Bordena-AW0.04-Windows-x64/`. В нём executable, setup,
лицензии, исходники MPL и SHA256SUMS.txt. Установщик создан, но не устанавливался
на рабочую машину пользователя.

Проверки на чистой Windows 10/11, установка/переустановка/удаление, совместная
установка с Doska и запуск релизного профиля — запланированы на **1.0**, не блокируют 0.6. Эти результаты нельзя
выводить из успешной компиляции. Подпись и публикация в эту итерацию не входят.

## Изолированная проверка

Native QA использует debug и только `.tools/qa-*`; точный native storage_profile
проверяется перед действиями. Release игнорирует BORDENA_TEST_PROFILE и не
запускается автотестами на реальных пользовательских данных.

`pnpm e2e` выполняет embedded native-регрессии через WebView2 CDP, не запускает
внешний браузер. `scripts/qa-roundtrip.ps1` временно использует Tauri dev с локальным
сервером 127.0.0.1 только для проверки текущих модулей экспорта/восстановления.
После него пересоберите embedded debug через dev.bat; обычный запуск сервера не требует.

0.5: после проверки `pnpm test:features` используется embedded debug через
`pnpm test:launcher`, затем `pnpm test:planning:embedded`. Они работают только с
изолированными `.tools/qa-*` профилями. Результаты и ограничения — в отчёте 0.5.

Комплект 0.5: `artifacts/Bordena-AW0.05-Windows-x64/` — Bordena.exe 0.0.5,
Bordena_0.0.5_x64-setup.exe, лицензии/исходники MPL и SHA256SUMS.txt (78 файлов).
Сборка и dev.bat/native QA пройдены. Установщик не запускался на рабочем профиле.

## 0.6 Smart Calendar

Архивный комплект: `artifacts/Bordena-AW0.06-Windows-x64/`. В него входят
`Bordena.exe`, `Bordena_0.0.6_x64-setup.exe`, лицензии, исходники MPL и проверенные
SHA-256. Исторические комплекты сохранены. Чистая установка Windows остаётся
PENDING до 1.0; успешная сборка установщика не означает проверенную установку.

После `pnpm test:launcher` выполните `pnpm test:calendar`: три последовательных
сценария проверяют встроенный календарь, второе нативное окно, работу офлайн,
переход DST и нагрузку 1000 событий + 300 серий. Используется CDP уже запущенного
WebView2 приложения; внешний браузер не запускается. Все профили — `.tools/qa-*`.
Регрессии: `pnpm e2e` и `pnpm test:planning:embedded`.

Ограничения, результаты и замеры: `docs/BORDENA_AW006_IMPLEMENTATION_REPORT.md`.

## Текущая версия 0.6

Нумерация продукта: 0.1 → 0.2 → … → 0.6, без префикса AW.
Windows/SemVer: 0.6.0. Актуальные выходы сборки:

- `apps/desktop/src-tauri/target/release/bordena.exe`
- `apps/desktop/src-tauri/target/release/bundle/nsis/Bordena_0.6.0_x64-setup.exe`

Запуск последней сборки — `Bordena.bat`; разработка с пересборкой — `dev.bat`.
Ранее собранные комплекты и evidence сохраняют исходные имена и версии как архив.

## Bordena 0.7

Актуальный запуск — C:\Bordena\Bordena.bat; разработка — dev.bat. Новый комплект: artifacts/Bordena-0.7-Windows-x64/. Прежний пользовательский путь artifacts/Bordena-AW0.06-Windows-x64/Bordena.exe обновляется после проверенной архивной копии и закрытия процесса. Проверки новой версии: docs/BORDENA_07_IMPLEMENTATION_REPORT.md. Чистая установка остаётся PENDING до 1.0.

## Bordena 0.7.1

Актуальный комплект — artifacts/Bordena-0.7.1-Windows-x64/. Привычный Bordena-AW0.06-Windows-x64/Bordena.exe обновляется той же 0.7.1 после проверенного ZIP предыдущего комплекта. Комплект 0.7 сохраняется. Запуск — Bordena.bat, пересборка — dev.bat. Отчёт: BORDENA_071_VISUAL_FIDELITY_REPORT.md.
