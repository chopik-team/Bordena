# Сторонние лицензии Bordena

Код Bordena и исходный Doska — MIT. Copyright Margarita Romenkova сохранён;
изменения CHOPIK Team добавлены отдельной строкой. Код Kanri не переносился.
Лицензия приложения не меняет лицензии отдельных зависимостей.

## Проверенный состав

`evidence/frontend-packages.json` формируется Vite по реально включённым JS-модулям
и локальным шрифтам. Полные доступные LICENSE/NOTICE/OFL этих пакетов собраны в
`THIRD_PARTY_NOTICES.txt` и встроенном asset `third-party-notices.txt`.
React/React DOM — MIT, CodeMirror/Lezer — MIT, Base UI — MIT, Motion — MIT,
hello-pangea/dnd — Apache-2.0, Lucide — ISC, fflate — MIT, Zod — MIT.
Mulish Variable и Geist Mono Variable — OFL-1.1; шрифты встроены локально,
названия не менялись, OFL-уведомления включены. Иконки Doska заменены логотипом,
предоставленным пользователем; остальные пиктограммы — Lucide с собственной лицензией.

`evidence/rust-packages.json` содержит граф Windows x64 Cargo, включая build-time
зависимости. Тексты — `RUST_THIRD_PARTY_NOTICES.txt`. Для всех обнаруженных MPL-2.0
crate сохранены неизменённые доступные исходники в `licenses/mpl-sources`:
cssparser, cssparser-macros, dtoa-short, option-ext, selectors. Их MPL действует
на соответствующие файлы и не заменяется MIT. Эти исходники и уведомления
включаются ресурсами Tauri. Остальные обнаруженные условия: MIT/Apache-2.0,
BSD, ISC, Unicode-3.0, Zlib, CC0, Unlicense; dual-license допускает permissive вариант.

Полный pnpm inventory `evidence/npm-licenses.json` дополнительно включает
непоставляемые developer/upstream зависимости. MPL-2.0 lightningcss — build tool,
CC-BY-4.0 caniuse-lite — данные сборочного инструмента. Для node-forge
выбирается BSD-3-Clause из `(BSD-3-Clause OR GPL-2.0)`; это не заимствование GPL-кода.
Наличие GPL в названии альтернативы не делает продукт GPL.

## Ресурсы и инструменты

Происхождение логотипа и SHA256 — в NOTICE.md. Пользователь предоставил его
для Bordena; независимый аудит прав автора изображения по одному PNG невозможен.
Оригинальные рекламные PNG, NSIS sidebar/header и сайт Doska не используются в продукте.
Разработческие Rust/MSVC/SDK/Node/pnpm в `.tools` не являются частью установщика
и не должны публиковаться вместе с проектом как собственный код.
WebView2 — системный компонент Microsoft с собственными условиями.

Воспроизведение: `pnpm --filter client build`, затем
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/collect-rust-licenses.ps1`.
Перед первым публичным релизом повторить аудит на финальном Cargo.lock/pnpm-lock,
проверить комплект ресурсов установщика и права на публикуемый логотип.
