# Bordena W 1.0 — release checklist

Обновлено 11.11.2026. PASS означает фактическую проверку; PARTIAL — проверена только указанная область; PENDING — проверка или публикация не выполнена.

| Проверка | Статус | Результат |
|---|---|---|
| Baseline / откат исходников | PASS | Снимки Bordena и Launcher, обратное применение patch в отдельном Git index; исходный index сохранён |
| Полный архив AW 0.82 | PASS | Проверены содержимое, SHA-256 и исходный EXE |
| Версии | PASS | W 1.0 / 1.0.0; 19 package manifests; Cargo; Tauri; AW history RU/EN |
| TypeScript / lint / JS tests | PASS | 13 typecheck, 8 lint tasks; 684 JS/TS tests |
| Rust Bordena | PASS | 3 tests; Windows release build |
| Переводы | PASS | 796 literal keys, без пропусков |
| Native EXE и BAT | PASS | Встроенный release UI, офлайн, отдельные профили; W 1.0 в About |
| Быстрое добавление столбца | PASS | Пустая доска с минимальным одним столбцом, 3/5 столбцов, Enter, Undo/Redo, 640–1920 px, горизонтальная прокрутка; карточки/секции не создаются |
| UX smoke | PASS | История AW без дат в заголовках; 12 месяцев; RU/dark, EN/light, Compact/Focus; вкладки выключены по умолчанию |
| NSIS | PASS | Сборка, текущий пользователь, кириллица/пробелы в пути, регистрация, FileVersion 1.0.0, Publisher CHOPIK Team, Start-menu shortcut |
| Исходная AW 0.82 → W 1.0 | PASS | Оригинальный исторический EXE в изолированном NSIS; подписанная загрузка и обновление через native Launcher |
| W 1.0 → staging 1.0.1 | PASS | Полный HTTPS download → verify → NSIS → post-install → restart; Launcher не пересобирается между версиями |
| Сохранность данных | PASS | 6 досок, 1007 карточек, 15 секций, 2 управляемых вложения; все IDB stores, backup bytes, настройки; неизменность каждого пользовательского поля/хэша |
| Удаление / повторная установка | PASS | Настоящий NSIS uninstall, установка через карточку Launcher и прямая переустановка; Local/Roaming QA canaries и внешняя копия сохранены |
| Ошибки доставки | PASS | Тамперинг metadata, неверные подпись/хэш/размер/архитектура, HTTP error, обрыв, offline, работающая Bordena, повтор/откат, контролируемый exit 7 установщика |
| Восстановление после отказа | PARTIAL | Предыдущие программные файлы скопированы и проверены; отказ до замены сохраняет EXE. Полный автоматический rollback реестра Windows не реализован и не заявляется |
| Диск заполнен / аварийный сбой ОС | PENDING | Нужна управляемая fault-injection VM; физический диск пользователя намеренно не заполнялся |
| Launcher regression | PASS | 66 frontend tests; 41 Rust tests; privacy/Dev/Stable регрессии включены |
| Production Launcher | PARTIAL | Собирается без QA fixture transport; отдельный локальный комплект интеграции. Его публичный выпуск и обновление установленного Launcher отдельно не опубликованы |
| Лицензии | PASS | Doska / Margarita Romenkova / MIT, зависимости, OFL, Rust notices и исходники MPL включены |
| Очистка | PASS | 10 сгенерированных копий QA-скриптов и 2 неиспользуемых server-конфига удалены после проверенных архивов; оригинальные тесты/профили/лицензии/старые релизы сохранены; повторная сборка выполнена |
| CHOPIK assets | PASS | 4 ресурса скопированы, SHA-256 совпали; runtime-зависимость не добавлена |
| Подпись доставки | PASS | Долговременный закреплённый Minisign key; подписаны installer и точные metadata; независимая проверка в Rust |
| Windows Authenticode | PENDING | Доступного сертификата издателя нет; EXE не имеет Authenticode; возможен SmartScreen |
| Чистая Windows 10 x64 | PENDING | Отдельная VM/компьютер недоступны |
| Чистая Windows 11 x64 | PENDING | Проверена существующая Windows 11 x64 с WebView2, не чистая ОС |
| Установка отсутствующего WebView2 | PENDING | Настроен штатный downloadBootstrapper; чистая ОС без runtime не проверена |
| GitHub source | PASS | Очищенные исходники опубликованы в main chopik-team/Bordena; независимый снимок собран до EXE/NSIS и запущен в native QA |
| Public release / публичная загрузка в Launcher | PENDING | Не публиковать непроверенный установщик; нужен clean-OS QA и проверка реальной GitHub release ссылки |
| CI | PARTIAL | Единый workflow расширен: проверки, NSIS, optional protected signing и независимый verifier. Реальный удалённый запуск и signing secrets ещё не подтверждены |

Команды: `pnpm check:version`, `pnpm check:i18n`, `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build:windows`; `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml`; `pnpm --filter @bordena/e2e exec node w10-release-native.mjs`; `pnpm --filter @bordena/e2e exec node w10-launcher-native.mjs`.

Подпись/комплект: `node scripts/release/package.mjs`. Проверка: `cargo run --locked --manifest-path tools/release-verify/Cargo.toml -- <metadata> <installer> 1.0.0`. QA staging: `scripts/release/build-staging.ps1 -Version 1.0.1`; этот пакет не публиковать. Для новых профилей использовать только `.tools/qa-*` и `--bordena-qa`.
