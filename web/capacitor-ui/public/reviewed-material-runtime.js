/* Reviewed SillyClient material runtime.
 * Source: preview/card-runtime-sync-review.html, approved 2026-09-04.
 * Keep visual values synchronized with the approved HTML before changing them.
 */
      (() => {
        if (window.__SILLYCLIENT_REVIEWED_MATERIAL_INSTALLED__) return;
        window.__SILLYCLIENT_REVIEWED_MATERIAL_INSTALLED__ = true;
        const frame = {
          get contentDocument() { return document; },
          get contentWindow() { return window; },
          addEventListener(type, listener, options) {
            window.addEventListener(type, listener, options);
          },
        };
        let wallpaperBlur = 7;
        let previewStarted = false;
        let previewPollTimer = 0;
        let previewGeneration = 0;
        const TUNING_PANEL_LONG_PRESS_MS = 500;
        const TUNING_PANEL_LONG_PRESS_MOVE_PX = 8;
        let tuningPanelConcealed = true;

        const materialCss = `
          :root {
            --preview-success-rgb: 133 158 145;
            --preview-danger-rgb: 190 134 150;
            --primary: rgb(var(--preview-success-rgb));
            --accent: rgb(var(--preview-success-rgb) / 0.15);
            --ring: rgb(var(--preview-success-rgb));
            --destructive: rgb(var(--preview-danger-rgb));
          }

          body[data-preview-light] {
            --preview-success-rgb: 37 63 51;
            --preview-danger-rgb: 93 48 62;
            --primary: rgb(var(--preview-success-rgb));
            --accent: rgb(var(--preview-success-rgb) / 0.15);
            --ring: rgb(var(--preview-success-rgb));
            --destructive: rgb(var(--preview-danger-rgb));
          }

          /* 1 — 控制岛：暖酒红材质，竖屏随视口收敛，横屏限制最大宽度 */
          header.fixed.left-0.right-0.z-50 {
            left: 50% !important;
            right: auto !important;
            width: min(92vw, calc(100vw - 2rem));
            margin-inline: 0 !important;
            padding-inline: 0 !important;
            transform: translateX(-50%);
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 {
            width: 100%;
            background: rgba(42, 21, 34, 0.16) !important;
            border-color: transparent !important;
            -webkit-backdrop-filter: blur(20px) saturate(1.05) !important;
            backdrop-filter: blur(20px) saturate(1.05) !important;
            box-shadow:
              0 8px 22px rgba(7, 5, 10, 0.20),
              0 2px 6px rgba(7, 5, 10, 0.10),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.07),
              inset 0 -1px 0 rgba(9, 5, 8, 0.09),
              inset 0 0 0 0.5px rgba(255, 255, 255, 0.035) !important;
          }

          /* 中央时间控件：保留胶囊几何，使用与两侧按钮一致的轻微内凹光学面。 */
          header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button {
            position: relative;
            isolation: isolate;
            background: transparent !important;
            border: 1px solid transparent !important;
            box-shadow: none !important;
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
            opacity: 0.9;
            transform: none !important;
            filter: none !important;
            transition: opacity 160ms ease !important;
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: rgba(7, 5, 10, 0.10);
            box-shadow:
              inset 0 1.25px 2px rgba(0, 0, 0, 0.24),
              inset 0 -0.75px 0.75px rgba(255, 255, 255, 0.065),
              0 0.5px 0 rgba(255, 255, 255, 0.025);
            transform: none;
            transition:
              background-color 160ms ease,
              box-shadow 160ms ease,
              transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
            pointer-events: none;
            z-index: -1;
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button > * {
            position: relative;
            z-index: 1;
          }

          @media (hover: hover) and (pointer: fine) {
            header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button:hover {
              opacity: 1;
              background: transparent !important;
              transform: none !important;
            }

            header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button:hover::before {
              background: rgba(7, 5, 10, 0.135);
            }
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button:active {
            transform: none !important;
            filter: none !important;
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button:active::before {
            background: rgba(7, 5, 10, 0.16);
            box-shadow:
              inset 0 1.75px 2.75px rgba(0, 0, 0, 0.29),
              inset 0 -0.5px 0.5px rgba(255, 255, 255, 0.045);
            transform: scale(0.985);
          }

          /* 两侧功能键：保留原点击热区，用居中的圆形内层形成 Home 键式轻微内凹反差。 */
          header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn {
            position: relative;
            isolation: isolate;
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
            opacity: 0.9;
            transform: none !important;
            transition: opacity 160ms ease !important;
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn::before {
            content: "";
            position: absolute;
            left: 50%;
            top: 50%;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(7, 5, 10, 0.10);
            box-shadow:
              inset 0 1.25px 2px rgba(0, 0, 0, 0.24),
              inset 0 -0.75px 0.75px rgba(255, 255, 255, 0.065),
              0 0.5px 0 rgba(255, 255, 255, 0.025);
            transform: translate(-50%, -50%);
            transition:
              background-color 160ms ease,
              box-shadow 160ms ease,
              transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
            pointer-events: none;
            z-index: -1;
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn svg {
            position: relative;
            z-index: 1;
            transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          @media (hover: hover) and (pointer: fine) {
            header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn:hover {
              opacity: 1;
            }

            header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn:hover::before {
              background: rgba(7, 5, 10, 0.135);
            }
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn:active::before {
            background: rgba(7, 5, 10, 0.16);
            box-shadow:
              inset 0 1.75px 2.75px rgba(0, 0, 0, 0.29),
              inset 0 -0.5px 0.5px rgba(255, 255, 255, 0.045);
            transform: translate(-50%, -50%) scale(0.965);
          }

          header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn:active svg {
            transform: scale(0.97);
          }

          body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 {
            background: rgba(255, 255, 255, 0.5) !important;
            border-color: transparent !important;
            box-shadow:
              0 8px 22px rgba(36, 30, 43, 0.13),
              0 2px 6px rgba(36, 30, 43, 0.06),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.6),
              inset 0 -1px 0 rgba(36, 30, 43, 0.05),
              inset 0 0 0 0.5px rgba(36, 30, 43, 0.045) !important;
          }

          body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button {
            background: transparent !important;
            border-color: transparent !important;
            box-shadow: none !important;
          }

          body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button::before {
            background: rgba(36, 30, 43, 0.055);
            box-shadow:
              inset 0 1.25px 2px rgba(36, 30, 43, 0.14),
              inset 0 -0.75px 0.75px rgba(255, 255, 255, 0.62),
              0 0.5px 0 rgba(255, 255, 255, 0.24);
          }

          @media (hover: hover) and (pointer: fine) {
            body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button:hover::before {
              background: rgba(36, 30, 43, 0.075);
            }
          }

          body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 > .flex-1 > button:active::before {
            background: rgba(36, 30, 43, 0.085);
            box-shadow:
              inset 0 1.75px 2.75px rgba(36, 30, 43, 0.18),
              inset 0 -0.5px 0.5px rgba(255, 255, 255, 0.44);
          }

          body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn {
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn::before {
            background: rgba(36, 30, 43, 0.055);
            box-shadow:
              inset 0 1.25px 2px rgba(36, 30, 43, 0.14),
              inset 0 -0.75px 0.75px rgba(255, 255, 255, 0.62),
              0 0.5px 0 rgba(255, 255, 255, 0.24);
          }

          @media (hover: hover) and (pointer: fine) {
            body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn:hover::before {
              background: rgba(36, 30, 43, 0.075);
            }
          }

          body[data-preview-light] header.fixed.left-0.right-0.z-50 > div.h-12 .ios-glass-btn:active::before {
            background: rgba(36, 30, 43, 0.085);
            box-shadow:
              inset 0 1.75px 2.75px rgba(36, 30, 43, 0.18),
              inset 0 -0.5px 0.5px rgba(255, 255, 255, 0.44);
          }

          @media (orientation: landscape) {
            header.fixed.left-0.right-0.z-50 {
              width: min(calc(100vw - 2rem), 42rem);
            }
          }

          /* 2 — 背景设置菜单：柔和阴影 */
          [data-preview-bg-panel] {
            box-shadow:
              0 14px 30px rgba(13, 7, 12, 0.17),
              0 2px 8px rgba(13, 7, 12, 0.055),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.06) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] {
            box-shadow:
              0 14px 30px rgba(36, 30, 43, 0.11),
              0 2px 8px rgba(36, 30, 43, 0.035),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.56) !important;
          }

          /* 2b — 菜单弹出/收回动画：显式启用应用自带的 panel-pop 序列 */
          .ios-floating-menu.bg-panel-enter {
            animation: panel-pop-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both !important;
          }

          .ios-floating-menu.bg-panel-exit {
            animation: panel-pop-out 0.3s cubic-bezier(0.22, 1, 0.36, 1) both !important;
          }

          @keyframes preview-panel-fade-in {
            from { opacity: 0; }
          }

          @keyframes preview-panel-fade-out {
            to { opacity: 0; }
          }

          /* 3 — 壁纸：标题保持在壁纸之上 + 磨砂遮罩 */
          [data-preview-root] > main {
            position: relative;
            z-index: 10;
          }

          [data-preview-wallpaper] {
            overflow: hidden;
            isolation: isolate;
          }

          [data-preview-wallpaper]::before,
          [data-preview-wallpaper]::after {
            content: "";
            position: absolute;
            pointer-events: none;
          }

          [data-preview-wallpaper]::before {
            z-index: 0;
            inset: -20px;
            background-image: var(--preview-wallpaper-image);
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
            filter: blur(var(--preview-wallpaper-blur, 7px));
            transform: scale(1.045);
          }

          [data-preview-wallpaper]::after {
            z-index: 1;
            inset: 0;
            background: rgba(16, 10, 16, 0.23);
            -webkit-backdrop-filter: blur(1px);
            backdrop-filter: blur(1px);
          }

          body[data-preview-light] [data-preview-wallpaper]::after {
            background: rgba(255, 255, 255, 0.28);
          }

          [data-preview-logo] > span {
            text-shadow: 0 1px 9px rgba(0, 0, 0, 0.26);
          }

          body[data-preview-light] [data-preview-logo] > span {
            text-shadow:
              0 1px 8px rgba(255, 255, 255, 0.45),
              0 1px 2px rgba(32, 20, 27, 0.14);
          }

          /* 4 — 壁纸磨砂强度滑条：与面板原有标签/控件间距对齐 */
          .preview-wallpaper-blur-control {
            display: grid;
            gap: calc(0.75rem - 5.5px);
          }

          /* —— 柔焦参数调试面板（临时）：悬浮右侧，5 参数实时调 */
          .preview-tuning-panel {
            position: fixed;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 9999;
            width: 232px;
            padding: 12px;
            border-radius: 16px;
            background: rgba(20, 14, 22, 0.72);
            -webkit-backdrop-filter: blur(24px) saturate(1.4);
            backdrop-filter: blur(24px) saturate(1.4);
            border: 1px solid rgba(255, 255, 255, 0.09);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
            font-size: 11px;
            color: rgba(255, 255, 255, 0.75);
            font-family: -apple-system, "SF Pro Text", "PingFang SC", sans-serif;
            user-select: none;
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transition:
              opacity 180ms ease,
              visibility 0s linear 0s;
          }

          .preview-tuning-panel[data-preview-concealed="true"] {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition:
              opacity 140ms ease,
              visibility 0s linear 140ms;
          }

          @media (prefers-reduced-motion: reduce) {
            .preview-tuning-panel,
            .preview-tuning-panel[data-preview-concealed="true"] {
              transition: none;
            }
          }

          .preview-tuning-panel h3 {
            margin: 0 0 8px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.04em;
            color: rgba(255, 255, 255, 0.55);
            display: flex;
            justify-content: space-between;
            align-items: center;
            touch-action: none;
          }

          .preview-tuning-panel h3 button {
            border: 0;
            background: rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.6);
            border-radius: 6px;
            font-size: 10px;
            padding: 2px 7px;
            cursor: pointer;
          }

          .preview-tuning-row {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 2px 8px;
            margin-bottom: 4px;
          }

          .preview-tuning-row label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.68);
          }

          .preview-tuning-row output {
            font-size: 10px;
            font-variant-numeric: tabular-nums;
            color: rgba(255, 255, 255, 0.4);
          }

          .preview-tuning-row input[type="range"] {
            grid-column: 1 / -1;
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 18px;
            background: transparent;
            cursor: pointer;
          }

          .preview-tuning-row input[type="range"]::-webkit-slider-runnable-track {
            height: 5px;
            border-radius: 9999px;
            background: linear-gradient(to right,
              rgba(228, 186, 204, 0.55) var(--pct, 50%),
              rgba(255, 255, 255, 0.12) var(--pct, 50%));
          }

          .preview-tuning-row input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 13px;
            height: 13px;
            margin-top: -4px;
            border-radius: 50%;
            border: 1px solid rgba(28, 23, 34, 0.4);
            background: radial-gradient(circle at 35% 30%, #fff 0%, #e3e0e7 55%, #b3b0bb 100%);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          }

          .preview-tuning-row input[type="range"]::-moz-range-track {
            height: 5px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.12);
          }

          .preview-tuning-row input[type="range"]::-moz-range-thumb {
            width: 13px;
            height: 13px;
            border-radius: 50%;
            border: 1px solid rgba(28, 23, 34, 0.4);
            background: radial-gradient(circle at 35% 30%, #fff 0%, #e3e0e7 55%, #b3b0bb 100%);
          }

          .preview-tuning-panel .preview-tuning-values {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 10px;
            line-height: 1.7;
            color: rgba(255, 255, 255, 0.38);
            font-variant-numeric: tabular-nums;
            white-space: pre;
          }

          .preview-tuning-panel .preview-tuning-section {
            margin: 10px 0 6px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.06em;
            color: rgba(228, 186, 204, 0.5);
            padding-bottom: 4px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .preview-tuning-panel .preview-tuning-section:first-of-type {
            margin-top: 2px;
          }

          .preview-tuning-preset-current {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: center;
            gap: 4px 8px;
          }

          .preview-tuning-preset-mode {
            display: inline-flex;
            align-items: center;
            min-height: 20px;
            padding: 0 7px;
            border-radius: 9999px;
            background: rgba(228, 186, 204, 0.11);
            box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.09);
            color: rgba(255, 255, 255, 0.76);
            font-size: 10px;
            font-weight: 600;
          }

          .preview-tuning-preset-time {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 9px;
            font-variant-numeric: tabular-nums;
            color: rgba(255, 255, 255, 0.35);
          }

          .preview-tuning-preset-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 4px;
            margin-top: 3px;
          }

          .preview-tuning-preset-actions button,
          .preview-tuning-history-item button {
            border: 0;
            background: rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.6);
            border-radius: 6px;
            font-size: 9px;
            line-height: 1;
            min-height: 24px;
            padding: 0 6px;
            cursor: pointer;
          }

          .preview-tuning-preset-actions button:hover,
          .preview-tuning-history-item button:hover {
            background: rgba(255, 255, 255, 0.14);
          }

          .preview-tuning-history {
            margin-top: 8px;
            padding-top: 7px;
            border-top: 1px solid rgba(255, 255, 255, 0.065);
          }

          .preview-tuning-history summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 20px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 10px;
            cursor: pointer;
            list-style: none;
          }

          .preview-tuning-history summary::-webkit-details-marker {
            display: none;
          }

          .preview-tuning-history summary::after {
            content: "+";
            color: rgba(255, 255, 255, 0.3);
            font-size: 12px;
          }

          .preview-tuning-history[open] summary::after {
            content: "−";
          }

          .preview-tuning-history-list {
            display: grid;
            gap: 4px;
            max-height: 144px;
            margin-top: 5px;
            overflow-y: auto;
            scrollbar-width: thin;
          }

          .preview-tuning-history-empty {
            padding: 5px 0 2px;
            color: rgba(255, 255, 255, 0.28);
            font-size: 9px;
          }

          .preview-tuning-history-item {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: 4px;
            padding-top: 4px;
            border-top: 1px solid rgba(255, 255, 255, 0.045);
          }

          .preview-tuning-history-item:first-child {
            padding-top: 0;
            border-top: 0;
          }

          .preview-tuning-history-item time {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: rgba(255, 255, 255, 0.4);
            font-size: 9px;
            font-variant-numeric: tabular-nums;
          }

          .preview-tuning-history-item button {
            min-height: 21px;
            padding-inline: 6px;
          }

          .preview-tuning-panel .preview-tuning-rgb {
            margin-bottom: 6px;
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 2px 8px;
            align-items: center;
          }

          .preview-tuning-panel .preview-tuning-rgb > label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.68);
          }

          .preview-tuning-panel .preview-tuning-rgb > output {
            font-size: 10px;
            font-variant-numeric: tabular-nums;
            color: rgba(255, 255, 255, 0.4);
          }

          .preview-tuning-panel .preview-tuning-swatch {
            width: 20px;
            height: 20px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.22);
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            padding: 0;
          }

          .preview-color-pop {
            position: fixed;
            z-index: 10001;
            display: grid;
            justify-items: center;
            gap: 10px;
            padding: 12px;
            border-radius: 14px;
            background: rgba(20, 14, 22, 0.9);
            -webkit-backdrop-filter: blur(24px) saturate(1.4);
            backdrop-filter: blur(24px) saturate(1.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
          }

          .preview-color-wheel {
            position: relative;
          }

          .preview-color-wheel canvas {
            display: block;
            border-radius: 50%;
            cursor: crosshair;
            touch-action: none;
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
          }

          .preview-color-thumb {
            position: absolute;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid #fff;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.5);
            pointer-events: none;
            transform: translate(-50%, -50%);
          }

          .preview-color-vbar {
            position: relative;
            width: 132px;
            height: 10px;
            border-radius: 9999px;
            cursor: pointer;
            touch-action: none;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
            overflow: hidden;
          }

          .preview-color-vfill {
            position: absolute;
            inset: 0;
          }

          .preview-color-vthumb {
            position: absolute;
            top: 50%;
            width: 16px;
            height: 16px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 2px solid #fff;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.5);
            pointer-events: none;
          }

          .preview-color-hex {
            width: 92px;
            padding: 3px 8px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(255, 255, 255, 0.06);
            color: rgba(255, 255, 255, 0.85);
            font-size: 11px;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.05em;
            text-align: center;
            outline: none;
          }

          .preview-color-hex:focus {
            border-color: rgba(228, 186, 204, 0.6);
          }

          .preview-tuning-panel.preview-tuning-panel--draggable {
            max-height: calc(100vh - 48px);
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
          }

          .preview-tuning-panel.preview-tuning-panel--draggable::-webkit-scrollbar {
            width: 4px;
          }

          .preview-tuning-panel.preview-tuning-panel--draggable::-webkit-scrollbar-thumb {
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.12);
          }

          /* 磨砂强度滑块：恢复原点纹凹槽，保留当前扁平拨杆。 */
          .preview-blur-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 24px;
            background: transparent;
            outline: none;
            cursor: pointer;
          }

          .preview-blur-slider::-webkit-slider-runnable-track {
            height: 13px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 255, 255, 0.07);
            background-image:
              radial-gradient(circle at 50% 50%,
                rgba(255, 255, 255, 0.17) 0 0.9px,
                rgba(255, 255, 255, 0.17) 0.9px,
                transparent 1.9px),
              linear-gradient(to right,
                rgba(255, 255, 255, 0.10) var(--pct, 44%),
                rgba(255, 255, 255, 0.03) calc(var(--pct, 44%) + 8px));
            background-size:
              14px 100%,
              100% 100%;
            background-repeat: repeat-x, no-repeat;
            box-shadow:
              inset 0 1.5px 3px rgba(0, 0, 0, 0.16),
              inset 0 -0.5px 0 rgba(255, 255, 255, 0.045);
          }

          .preview-blur-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 10px;
            margin-top: 1.5px;
            border: 0;
            border-radius: 5px;
            background: rgba(232, 229, 235, 0.94);
            box-shadow:
              0 1px 2px rgba(7, 5, 10, 0.24),
              inset 0 0 0 0.5px rgba(28, 23, 34, 0.16),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.48);
            cursor: pointer;
          }

          .preview-blur-slider::-moz-range-track {
            height: 13px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 255, 255, 0.07);
            background-image:
              radial-gradient(circle at 50% 50%,
                rgba(255, 255, 255, 0.17) 0 0.9px,
                rgba(255, 255, 255, 0.17) 0.9px,
                transparent 1.9px),
              linear-gradient(to right,
                rgba(255, 255, 255, 0.10) var(--pct, 44%),
                rgba(255, 255, 255, 0.03) calc(var(--pct, 44%) + 8px));
            background-size:
              14px 100%,
              100% 100%;
            background-repeat: repeat-x, no-repeat;
            box-shadow:
              inset 0 1.5px 3px rgba(0, 0, 0, 0.16),
              inset 0 -0.5px 0 rgba(255, 255, 255, 0.045);
          }

          .preview-blur-slider::-moz-range-thumb {
            width: 18px;
            height: 10px;
            border: 0;
            border-radius: 5px;
            background: rgba(232, 229, 235, 0.94);
            box-shadow:
              0 1px 2px rgba(7, 5, 10, 0.24),
              inset 0 0 0 0.5px rgba(28, 23, 34, 0.16),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.48);
            cursor: pointer;
          }

          body[data-preview-light] .preview-blur-slider::-webkit-slider-runnable-track {
            border-color: rgba(36, 30, 43, 0.10);
            background-image:
              radial-gradient(circle at 50% 50%,
                rgba(36, 30, 43, 0.18) 0 0.9px,
                rgba(36, 30, 43, 0.18) 0.9px,
                transparent 1.9px),
              linear-gradient(to right,
                rgba(36, 30, 43, 0.12) var(--pct, 44%),
                rgba(36, 30, 43, 0.045) calc(var(--pct, 44%) + 8px));
            box-shadow:
              inset 0 1.5px 3px rgba(36, 30, 43, 0.10),
              inset 0 -0.5px 0 rgba(255, 255, 255, 0.5);
          }

          body[data-preview-light] .preview-blur-slider::-webkit-slider-thumb {
            background: rgba(255, 255, 255, 0.94);
            box-shadow:
              0 1px 2px rgba(36, 30, 43, 0.15),
              inset 0 0 0 0.5px rgba(36, 30, 43, 0.11),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.64);
          }

          body[data-preview-light] .preview-blur-slider::-moz-range-track {
            border-color: rgba(36, 30, 43, 0.10);
            background-image:
              radial-gradient(circle at 50% 50%,
                rgba(36, 30, 43, 0.18) 0 0.9px,
                rgba(36, 30, 43, 0.18) 0.9px,
                transparent 1.9px),
              linear-gradient(to right,
                rgba(36, 30, 43, 0.12) var(--pct, 44%),
                rgba(36, 30, 43, 0.045) calc(var(--pct, 44%) + 8px));
            box-shadow:
              inset 0 1.5px 3px rgba(36, 30, 43, 0.10),
              inset 0 -0.5px 0 rgba(255, 255, 255, 0.5);
          }

          body[data-preview-light] .preview-blur-slider::-moz-range-thumb {
            background: rgba(255, 255, 255, 0.94);
            box-shadow:
              0 1px 2px rgba(36, 30, 43, 0.15),
              inset 0 0 0 0.5px rgba(36, 30, 43, 0.11),
              inset 0 0.5px 0 rgba(255, 255, 255, 0.64);
          }

          /* 4b — 壁纸导入组块：中性玻璃材质，替换原有大红大绿状态色 */
          [data-preview-bg-panel] [class*="bg-emerald-500/20"] {
            background: rgb(var(--preview-success-rgb) / 0.14) !important;
          }

          [data-preview-bg-panel] [class*="text-emerald-400"] {
            color: rgb(var(--preview-success-rgb) / 0.82) !important;
          }

          [data-preview-bg-panel] [class*="bg-red-500/10"] {
            background: rgb(var(--preview-danger-rgb) / 0.055) !important;
          }

          [data-preview-bg-panel] [class*="bg-red-500/15"]:hover {
            background: rgb(var(--preview-danger-rgb) / 0.09) !important;
          }

          [data-preview-bg-panel] [class*="border-red-500/20"] {
            border-color: rgb(var(--preview-danger-rgb) / 0.11) !important;
          }

          [data-preview-bg-panel] [class*="text-red-500"],
          [data-preview-bg-panel] [class*="text-red-400"] {
            color: rgb(var(--preview-danger-rgb) / 0.72) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [class*="bg-emerald-500/20"] {
            background: rgb(var(--preview-success-rgb) / 0.1) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [class*="text-emerald-400"] {
            color: rgb(var(--preview-success-rgb) / 0.88) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [class*="bg-red-500/10"] {
            background: rgb(var(--preview-danger-rgb) / 0.045) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [class*="bg-red-500/15"]:hover {
            background: rgb(var(--preview-danger-rgb) / 0.08) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [class*="border-red-500/20"] {
            border-color: rgb(var(--preview-danger-rgb) / 0.12) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [class*="text-red-500"],
          body[data-preview-light] [data-preview-bg-panel] [class*="text-red-400"] {
            color: rgb(var(--preview-danger-rgb) / 0.86) !important;
          }

          /* 4c — 语义色：红绿只保留两套色相，组件层级仅通过透明度区分。 */
          [data-preview-root] [class*="text-emerald-"],
          [data-preview-root] [class*="text-green-"],
          [data-preview-root] [class*="text-lime-"] {
            color: rgb(var(--preview-success-rgb) / 0.82) !important;
          }

          [data-preview-root] [class*="bg-emerald-"],
          [data-preview-root] [class*="bg-green-"],
          [data-preview-root] [class*="bg-lime-"] {
            background-color: rgb(var(--preview-success-rgb) / 0.14) !important;
          }

          [data-preview-root] [class*="border-emerald-"],
          [data-preview-root] [class*="border-green-"],
          [data-preview-root] [class*="border-lime-"] {
            border-color: rgb(var(--preview-success-rgb) / 0.12) !important;
          }

          [data-preview-root] [class*="text-red-"] {
            color: rgb(var(--preview-danger-rgb) / 0.72) !important;
          }

          [data-preview-root] [class*="bg-red-"] {
            background-color: rgb(var(--preview-danger-rgb) / 0.055) !important;
          }

          [data-preview-root] [class*="border-red-"] {
            border-color: rgb(var(--preview-danger-rgb) / 0.11) !important;
          }

          .ios-toggle-track-active {
            background: #34c759 !important;
            border-color: transparent !important;
            box-shadow:
              0 0 12px rgba(52, 199, 89, 0.4),
              0 0 4px rgba(52, 199, 89, 0.2) !important;
          }

          ::selection {
            background: rgb(var(--preview-success-rgb) / 0.22) !important;
          }

          input:focus-visible,
          textarea:focus-visible {
            border-color: rgb(var(--preview-success-rgb) / 0.72) !important;
            box-shadow: 0 0 0 3px rgb(var(--preview-success-rgb) / 0.16) !important;
          }

          .motion-instance-card [class~="bg-emerald-400/70"] {
            background-color: rgb(var(--preview-success-rgb) / 0.72) !important;
            box-shadow: 0 0 3px rgb(var(--preview-success-rgb) / 0.16) !important;
          }

          .motion-instance-card [class~="text-emerald-400/80"] {
            color: rgb(var(--preview-success-rgb) / 0.82) !important;
            box-shadow: none !important;
          }

          .motion-instance-card [class~="bg-red-400/60"] {
            background-color: rgb(var(--preview-danger-rgb) / 0.68) !important;
            box-shadow: 0 0 3px rgb(var(--preview-danger-rgb) / 0.14) !important;
          }

          .motion-instance-card [class~="text-red-400/60"] {
            color: rgb(var(--preview-danger-rgb) / 0.76) !important;
            box-shadow: none !important;
          }

          :is(.animate-terminal-enter, .animate-terminal-exit) [class~="text-red-400"] {
            color: rgb(var(--preview-danger-rgb) / 0.82) !important;
          }

          :is(.animate-terminal-enter, .animate-terminal-exit) [class~="text-emerald-400"] {
            color: rgb(var(--preview-success-rgb) / 0.82) !important;
          }

          :is(.animate-terminal-enter, .animate-terminal-exit) [class~="text-emerald-400/70"] {
            color: rgb(var(--preview-success-rgb) / 0.58) !important;
          }

          .instance-card-menu button[class*="text-red-"] {
            color: rgb(var(--preview-danger-rgb) / 0.58) !important;
          }

          .ios-task-surface[class~="z-[61]"] [class~="bg-red-500/80"] {
            background: rgb(var(--preview-danger-rgb) / 0.72) !important;
          }

          .ios-task-surface[class~="z-[61]"] [class~="text-red-400/90"] {
            color: rgb(var(--preview-danger-rgb) / 0.82) !important;
          }

          .ios-task-surface[class~="z-[61]"] [class~="text-emerald-400/90"],
          .ios-task-surface[class~="z-[61]"] [class~="text-emerald-400"] {
            color: rgb(var(--preview-success-rgb) / 0.84) !important;
          }

          .ios-task-surface[class~="z-[62]"]:not(.manage-panel-surface)
          [class*="border-red-"][class*="bg-red-"][class*="text-red-"] {
            color: rgb(var(--preview-danger-rgb) / 0.82) !important;
            border-color: rgb(var(--preview-danger-rgb) / 0.11) !important;
            background-color: rgb(var(--preview-danger-rgb) / 0.055) !important;
          }

          .manage-panel-surface [class*="text-red-"] {
            color: rgb(var(--preview-danger-rgb) / 0.7) !important;
          }

          .ios-task-surface[class~="z-[74]"] :is(
            [class*="text-[#a12c4c]"],
            [class*="text-[#e88ca5]"],
            [class*="text-[#783047]"],
            [class*="text-[#e8a2b5]"]
          ) {
            color: rgb(var(--preview-danger-rgb) / 0.76) !important;
          }

          .ios-task-surface[class~="z-[74]"] :is(
            [class*="border-[#a12c4c]"],
            [class*="border-[#e88ca5]"]
          ) {
            border-color: rgb(var(--preview-danger-rgb) / 0.11) !important;
            background-color: rgb(var(--preview-danger-rgb) / 0.055) !important;
          }

          .app-settings-action.is-danger {
            background: rgb(var(--preview-danger-rgb) / 0.045) !important;
            color: rgb(var(--preview-danger-rgb) / 0.66) !important;
          }

          @media (hover: hover) and (pointer: fine) {
            [data-preview-root] button[class*="hover:text-red-"]:hover {
              color: rgb(var(--preview-danger-rgb) / 0.84) !important;
            }

            [data-preview-root] button[class*="hover:bg-red-"]:hover {
              background-color: rgb(var(--preview-danger-rgb) / 0.09) !important;
            }

            .instance-card-menu button[class*="text-red-"]:hover,
            .manage-panel-surface button[class*="text-red-"]:hover {
              color: rgb(var(--preview-danger-rgb) / 0.84) !important;
            }

            .app-settings-action.is-danger:hover {
              background: rgb(var(--preview-danger-rgb) / 0.09) !important;
              color: rgb(var(--preview-danger-rgb) / 0.84) !important;
            }
          }

          /* 4d — 壁纸导入按钮：凸态 = vision-button，导入后凹陷 = vision-url-bar 配方 */
          [data-preview-bg-panel] [data-preview-wallpaper-import] {
            background: oklch(1 0 0 / 0.04) !important;
            border: 1px solid oklch(1 0 0 / 0.08) !important;
            box-shadow: none !important;
            transition: background-color 0.2s ease, box-shadow 0.25s ease, border-color 0.25s ease !important;
          }

          [data-preview-bg-panel] [data-preview-wallpaper-import]:hover {
            background: oklch(1 0 0 / 0.1) !important;
          }

          [data-preview-bg-panel] [data-preview-wallpaper-import][data-preview-has-wallpaper] {
            background: oklch(0.3 0.01 270 / 0.30) !important;
            border-color: oklch(0.3 0.012 270 / 0.35) !important;
            box-shadow:
              inset 0 2px 4px oklch(0 0 0 / 0.25),
              inset 0 1px 2px oklch(0 0 0 / 0.2),
              0 1px 0 oklch(1 0 0 / 0.05) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [data-preview-wallpaper-import] {
            background: oklch(1 0 0 / 0.2) !important;
            border: 1px solid oklch(1 0 0 / 0.15) !important;
            box-shadow: none !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [data-preview-wallpaper-import]:hover {
            background: oklch(1 0 0 / 0.35) !important;
          }

          body[data-preview-light] [data-preview-bg-panel] [data-preview-wallpaper-import][data-preview-has-wallpaper] {
            background: oklch(0.4 0.005 270 / 0.12) !important;
            border-color: oklch(0.3 0.008 270 / 0.2) !important;
            box-shadow:
              inset 0 2px 4px oklch(0.25 0.02 260 / 0.14),
              inset 0 1px 2px oklch(0.25 0.02 260 / 0.10),
              0 1px 0 oklch(1 0 0 / 0.5) !important;
          }

          /* 主题切换：根背景做短插值，真实主题提交后叠一层目标色淡出。
             不保存旧 DOM，也不对整棵子树施加 transition。 */
          #root > div[class*="duration-900"] {
            transition-property: background-color !important;
            transition-duration: 260ms !important;
            transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1) !important;
          }

          .preview-theme-wash {
            position: fixed;
            inset: 0;
            z-index: 2147483646;
            pointer-events: none;
            opacity: 0;
            contain: strict;
            will-change: opacity;
          }

          @media (prefers-reduced-motion: reduce) {
            #root > div[class*="duration-900"] {
              transition-duration: 1ms !important;
            }
          }

          /* 5 — 实例卡片：保持原透明玻璃底 + 轻微柔焦边缘。
             全部可调项走 CSS 变量，由右侧调试面板实时驱动（初值=v6）。
             圆角率 22px + background-clip: border-box 保证真圆角渲染。 */
          .motion-instance-card {
            border-radius: var(--sf-radius, 22px) !important;
            background-clip: border-box !important;
            background-color: rgba(var(--sf-fog-rgb, 255 250 252) / var(--sf-fog, 0)) !important;
            -webkit-backdrop-filter: blur(var(--sf-blur, 0px)) saturate(var(--sf-sat, 1.1)) !important;
            backdrop-filter: blur(var(--sf-blur, 0px)) saturate(var(--sf-sat, 1.1)) !important;
            box-shadow:
              inset 0 0 var(--sf-glow1-spread, 18px) 1px rgba(var(--sf-glow1-rgb, 228 186 204) / var(--sf-glow1, 0.11)),
              inset 0 0 var(--sf-glow2-spread, 40px) 0 rgba(var(--sf-glow2-rgb, 196 120 142) / var(--sf-glow2, 0.01)),
              0 var(--sf-sh-y, 3px) var(--sf-sh-blur, 12px) rgba(var(--sf-sh-rgb, 7 5 10) / var(--sf-sh-a, 0.075)) !important;
            transition: box-shadow 400ms cubic-bezier(0.22, 1, 0.36, 1) !important;
          }

          /* 噪点层：强度由 --sf-noise 驱动（调试面板） */
          .motion-instance-card > .preview-card-noise {
            display: block !important;
            opacity: var(--sf-noise, 0.03) !important;
          }

          /* 内部遮罩：整卡均匀一层深色半透（z:1，封面图之上、
             内容层 z:2 之下）。颜色+浓度全部可调（调试面板）。
             同时清掉源码盖层的 backdrop-filter: blur(16px)——
             它盖住整卡内部，面板任何滑块都关不掉，是卡片发虚的元凶 */
          .motion-instance-card::after {
            content: "" !important;
            position: absolute !important;
            inset: 0 !important;
            z-index: 1 !important;
            pointer-events: none !important;
            border-radius: inherit !important;
            background: rgba(var(--sf-cover-rgb, 18 16 20) / var(--sf-cover, 0.28)) !important;
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
          }

          /* 主题模式的遮罩同样走全局变量（浓度由面板统一控制） */
          body[data-preview-light] .motion-instance-card::after {
            background: rgba(var(--sf-cover-rgb, 18 16 20) / var(--sf-cover, 0.28)) !important;
          }

          /* 黑夜模式：遮罩略加深，配合靛蓝主题 */
          body[data-preview-dark-mode] .motion-instance-card::after {
            background: rgba(var(--sf-cover-rgb, 18 16 20) / var(--sf-cover, 0.28)) !important;
          }

          /* hover：无发光，改为轻微 3D 立体倾斜（JS 驱动，
             幅度 ±1.6deg，参考 soft-focus-glass 的 rotateX/Y 方案）。
             此处仅保留基础柔焦与过渡曲线。 */
          .motion-instance-card {
            transform-style: preserve-3d;
            /* transform 过渡只用于离开卡片时的回正（400ms 平滑归零）；
               指针在卡上时 JS 把 --tilt-dur 切到 0ms 实现即时跟随，
               避免缓动滞后带来的"整排晃动"观感。 */
            transition: box-shadow 400ms cubic-bezier(0.22, 1, 0.36, 1),
              transform var(--tilt-dur, 400ms) cubic-bezier(0.2, 0.8, 0.2, 1) !important;
          }

          /* 卡片倾斜的"工作框架"：透视不再放在轮播轨道（共享空间），
             而是写进每张卡片自己的 transform: perspective(900px)——
             原点自动落在卡片自身中心，每张卡在独立 3D 空间工作，
             构造上与邻卡零耦合。 */

          /* 滚动锚定禁用：卡片旋转导致几何边界微变时，Chrome 的
             scroll anchoring 会"补偿"scrollLeft，把整排卡片平移 1px
             ——这就是邻卡跟着晃的真凶。轨道与卡片都关闭。 */
          .carousel-scrollbar-hidden,
          .motion-instance-card {
            overflow-anchor: none !important;
          }

          /* 主题模式差异仅剩发光色；浓度/雾/遮罩统一由调试面板全局变量控制 */
          body[data-preview-light] .motion-instance-card {
            box-shadow:
              inset 0 0 var(--sf-glow1-spread, 18px) 1px rgba(var(--sf-glow1-rgb, 96 84 76) / var(--sf-glow1, 0.11)),
              inset 0 0 var(--sf-glow2-spread, 40px) 0 rgba(var(--sf-glow2-rgb, 110 96 86) / var(--sf-glow2, 0.01)),
              0 var(--sf-sh-y, 3px) var(--sf-sh-blur, 12px) rgba(var(--sf-sh-rgb, 120 100 80) / var(--sf-sh-a, 0.075)) !important;
          }

          body[data-preview-light] .motion-instance-card:hover {
            box-shadow:
              inset 0 0 var(--sf-glow1-spread, 18px) 1px rgba(var(--sf-glow1-rgb, 96 84 76) / var(--sf-glow1, 0.11)),
              inset 0 0 var(--sf-glow2-spread, 40px) 0 rgba(var(--sf-glow2-rgb, 110 96 86) / var(--sf-glow2, 0.01)),
              0 var(--sf-sh-y, 3px) var(--sf-sh-blur, 12px) rgba(var(--sf-sh-rgb, 120 100 80) / var(--sf-sh-a, 0.075)) !important;
          }

          /* 黑夜模式（indigo 系，与源码暗夜按钮 indigo-500 同族） */
          body[data-preview-dark-mode] .motion-instance-card {
            box-shadow:
              inset 0 0 var(--sf-glow1-spread, 18px) 1px rgba(var(--sf-glow1-rgb, 151 171 255) / var(--sf-glow1, 0.11)),
              inset 0 0 var(--sf-glow2-spread, 40px) 0 rgba(var(--sf-glow2-rgb, 120 140 230) / var(--sf-glow2, 0.01)),
              0 var(--sf-sh-y, 3px) var(--sf-sh-blur, 12px) rgba(var(--sf-sh-rgb, 7 5 10) / var(--sf-sh-a, 0.075)) !important;
          }

          body[data-preview-dark-mode] .motion-instance-card:hover {
            box-shadow:
              inset 0 0 var(--sf-glow1-spread, 18px) 1px rgba(var(--sf-glow1-rgb, 151 171 255) / var(--sf-glow1, 0.11)),
              inset 0 0 var(--sf-glow2-spread, 40px) 0 rgba(var(--sf-glow2-rgb, 120 140 230) / var(--sf-glow2, 0.01)),
              0 var(--sf-sh-y, 3px) var(--sf-sh-blur, 12px) rgba(var(--sf-sh-rgb, 7 5 10) / var(--sf-sh-a, 0.075)) !important;
          }

          /* 已创建实例卡：去掉源码内联的灰/黑遮罩盖层与 blur 磨砂，
             遮罩统一由内容层的酒红渐变（下方规则）承担 */
          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > div:first-child > div[style*="background"] {
            background: transparent !important;
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
          }

          /* 源码里 hover 前后的黑色渐变遮罩层（bg-gradient-to-t from-black/...）压成透明 */
          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > div[class*="from-black"] {
            background-image: none !important;
            background: transparent !important;
          }

          /* 收起/展开遮罩各自独立成固定合成层，只交叉淡入淡出；
             遮罩不再参与详情内容的弹性位移。 */
          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative {
            --card-reveal-ease: cubic-bezier(0.2, 0, 0, 1);
            --card-focus-ease: cubic-bezier(0.25, 0.1, 0.25, 1);
            --card-fade-ease: cubic-bezier(0.4, 0, 0.2, 1);
            --card-title-lift: -76px;
            isolation: isolate;
            background: transparent !important;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::before,
          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::after {
            content: "";
            position: absolute;
            z-index: 0;
            inset: 0;
            border-radius: inherit;
            pointer-events: none;
            transform: none !important;
            will-change: opacity;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::before {
            opacity: 1;
            transition: opacity 460ms var(--card-fade-ease);
            background: linear-gradient(
              to top,
              rgba(var(--sf-grad-rgb, 30 15 24) / var(--sf-grad-bc, 0.55)) 0%,
              rgba(var(--sf-grad-rgb, 30 15 24) / calc(var(--sf-grad-bc, 0.55) * 0.51)) calc(var(--sf-grad-hc, 68%) * 0.56),
              rgba(var(--sf-grad-rgb, 30 15 24) / calc(var(--sf-grad-bc, 0.55) * 0.11)) var(--sf-grad-hc, 68%),
              transparent 100%
            );
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::after {
            opacity: 0;
            transition: opacity 460ms var(--card-fade-ease);
            background: linear-gradient(
              to top,
              rgba(var(--sf-grad-rgb, 30 15 24) / var(--sf-grad-be, 0.72)) 0%,
              rgba(var(--sf-grad-rgb, 30 15 24) / calc(var(--sf-grad-be, 0.72) * 0.62)) calc(var(--sf-grad-he, 85%) * 0.65),
              rgba(var(--sf-grad-rgb, 30 15 24) / calc(var(--sf-grad-be, 0.72) * 0.17)) var(--sf-grad-he, 85%),
              transparent 100%
            );
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative > * {
            position: relative;
            z-index: 1;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]).is-expanded > .relative::before {
            opacity: 0;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]).is-expanded > .relative::after {
            opacity: 1;
          }

          /* 浅色模式沿用独立浅色参数，只替换两张遮罩层的填充。 */
          body[data-preview-light] .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::before {
            background: linear-gradient(
              to top,
              rgba(var(--sf-lg-rgb, 244 240 237) / var(--sf-lg-bc, 0.92)) 0%,
              rgba(var(--sf-lg-rgb, 244 240 237) / calc(var(--sf-lg-bc, 0.92) * 0.85)) calc(var(--sf-lg-hc, 75%) * 0.6),
              rgba(var(--sf-lg-rgb, 244 240 237) / calc(var(--sf-lg-bc, 0.92) * 0.33)) var(--sf-lg-hc, 75%),
              rgba(var(--sf-lg-rgb, 244 240 237) / calc(var(--sf-lg-bc, 0.92) * 0.09)) calc(var(--sf-lg-hc, 75%) * 1.22),
              transparent 100%
            );
          }

          body[data-preview-light] .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::after {
            background: linear-gradient(
              to top,
              rgba(var(--sf-lg-rgb, 244 240 237) / var(--sf-lg-be, 0.96)) 0%,
              rgba(var(--sf-lg-rgb, 244 240 237) / calc(var(--sf-lg-be, 0.96) * 0.92)) calc(var(--sf-lg-he, 82%) * 0.67),
              rgba(var(--sf-lg-rgb, 244 240 237) / calc(var(--sf-lg-be, 0.96) * 0.47)) var(--sf-lg-he, 82%),
              rgba(var(--sf-lg-rgb, 244 240 237) / calc(var(--sf-lg-be, 0.96) * 0.16)) calc(var(--sf-lg-he, 82%) * 1.16),
              transparent 100%
            );
          }

          /* System focus transition：旧信息先退场，标题与详情沿同一条缓入曲线交接。
             不拆字、不弹跳，也不使用前段过快、看似瞬切的减速曲线。 */
          .motion-instance-card[data-card-index]:not([data-card-index="0"]) .preview-card-subtitle {
            align-self: flex-start;
            width: fit-content;
            max-width: 100%;
            opacity: 0.94;
            letter-spacing: 0;
            transform: translate3d(0, 0, 0) scale(1);
            transform-origin: left center;
            filter: brightness(1);
            will-change: opacity, transform;
            transition:
              opacity 220ms var(--card-fade-ease) 90ms,
              transform 420ms var(--card-focus-ease) 70ms,
              filter 260ms var(--card-fade-ease) 90ms !important;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]).is-expanded .preview-card-subtitle {
            opacity: 1;
            filter: brightness(1.06);
            transform: translate3d(0, var(--card-title-lift), 0) scale(1.07);
            transition:
              opacity 280ms var(--card-fade-ease),
              transform 440ms var(--card-focus-ease),
              filter 300ms var(--card-fade-ease) !important;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) .preview-card-status {
            opacity: 1;
            transform: translate3d(0, 0, 0);
            transform-origin: left center;
            will-change: opacity, transform;
            transition:
              opacity 220ms var(--card-fade-ease) 130ms,
              transform 320ms var(--card-focus-ease) 90ms !important;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]).is-expanded .preview-card-status {
            opacity: 0;
            transform: translate3d(0, -8px, 0);
            transition:
              opacity 180ms var(--card-fade-ease),
              transform 260ms var(--card-focus-ease) !important;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) .motion-accordion {
            position: absolute !important;
            left: 14px;
            right: 14px;
            bottom: 14px;
            display: block !important;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translate3d(0, 18px, 0) !important;
            transform-origin: bottom center;
            will-change: opacity, transform;
            transition:
              opacity 240ms var(--card-fade-ease),
              transform 300ms var(--card-focus-ease),
              visibility 0s linear 300ms !important;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) .motion-accordion.is-open {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translate3d(0, 0, 0) !important;
            transition:
              opacity 360ms var(--card-fade-ease) 100ms,
              transform 430ms var(--card-focus-ease) 75ms,
              visibility 0s linear 0s !important;
          }

          .motion-instance-card[data-card-index]:not([data-card-index="0"]) .motion-accordion-inner {
            min-height: 0;
            overflow: visible;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
            transition: none !important;
            -webkit-mask-image: none !important;
            mask-image: none !important;
          }

          @media (prefers-reduced-motion: reduce) {
            .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::before,
            .motion-instance-card[data-card-index]:not([data-card-index="0"]) > .relative::after,
            .motion-instance-card[data-card-index]:not([data-card-index="0"]) .preview-card-subtitle,
            .motion-instance-card[data-card-index]:not([data-card-index="0"]) .preview-card-status,
            .motion-instance-card[data-card-index]:not([data-card-index="0"]) .motion-accordion,
            .motion-instance-card[data-card-index]:not([data-card-index="0"]) .motion-accordion-inner {
              transition: none !important;
            }

            .motion-instance-card[data-card-index]:not([data-card-index="0"]).is-expanded .preview-card-subtitle {
              transform: translate3d(0, var(--card-title-lift), 0);
            }

            .motion-instance-card[data-card-index]:not([data-card-index="0"]).is-expanded .preview-card-status {
              transform: none;
            }
          }

          /* 图片填充：源码内层容器/遮罩/内容层写死 rounded-[18px]，
             外层改 22px 后不同步，图片边缘留出细缝。
             用属性选择器统一内层圆角为 inherit，随外层自适应；
             图片铺满消除缝隙。 */
          .motion-instance-card > div[class*="rounded-"],
          .motion-instance-card img {
            border-radius: inherit !important;
          }

          .motion-instance-card img {
            display: block;
            width: 100% !important;
            height: 100% !important;
            opacity: var(--sf-img-op, 1) !important;
            filter: brightness(var(--sf-img-bri, 1)) saturate(var(--sf-img-sat, 1)) blur(var(--sf-img-blur, 0px)) !important;
          }

          /* 压掉源样式遗留的卡片伪元素盖层，保持背景通透
             （::after 已改为内部暗灰遮罩，见上方规则，只压 ::before） */
          .motion-instance-card::before {
            content: none !important;
          }

          /* 修复：源码收起态 .motion-accordion-inner 自带 filter: blur(3px)，
             卡片内部内容发虚且面板任何滑块都关不掉它，强制清除 */
          .motion-accordion-inner {
            filter: none !important;
          }

          /* 7 — 轮播全出血：卡片滑到屏幕物理边缘才被裁切。
             原先 overflow-x 的裁剪线落在屏幕内侧（手机约 40px、桌面约 180px），
             卡片在半空被硬切，看起来像被一层不明遮罩挡住。
             现在让滚动容器横向铺满视口：裁剪线与屏幕边缘重合，卡片自然滑出屏幕。
             padding-left/right 按原列对齐公式换算，首卡与内容列完全对齐不动。 */
          html,
          body,
          [data-preview-root] {
            overflow-x: clip;
          }

          .carousel-scrollbar-hidden {
            width: 100vw !important;
            margin-left: calc(50% - 50vw) !important;
            margin-right: 0 !important;
            padding-left: calc(max(0px, (100vw - 1200px) / 2) + 60px) !important;
            padding-right: calc(max(0px, (100vw - 1200px) / 2) + 60px) !important;
            /* 纵向呼吸空间：卡片阴影需要 44px（12 偏移+32 模糊），
               原 py-4 仅 16px 且 overflow 裁剪会硬切断阴影（断层）。
               padding 扩到 44px + 负边距 -28px 抵消外移：卡片位置与外部布局不变，
               裁剪区上下各延伸 28px，阴影完整渲染。 */
            padding-top: 44px !important;
            padding-bottom: 44px !important;
            margin-top: -28px !important;
            margin-bottom: -28px !important;
          }

          @media (max-width: 767px) {
            .carousel-scrollbar-hidden {
              padding-left: 52px !important;
              padding-right: 52px !important;
            }
          }

          /* 8 — 卡片轮播左右两侧渐进模糊：复刻 GradualBlur 组件配方。
             5 层遮罩带 + 递增 backdrop-filter 叠加，
             越靠近屏幕边缘模糊越强，卡片滑出时被渐进虚化而非硬切。 */
          .preview-edge-blur {
            position: fixed;
            width: clamp(30px, 8vw, 36px);
            pointer-events: none;
            z-index: 28;
          }

          .preview-edge-blur > div {
            position: absolute;
            inset: 0;
          }

          /* 9 — 壁纸添加/移除动效。
             添加 = 挂载后整层淡入（含磨砂遮罩）；
             移除 = React 卸载时克隆一份同材质节点淡出。
             出场刻意比入场慢：2200ms 长淡出，曲线 cubic-bezier(0.33,1,0.68,1)
             ——前段缓、末段收，观感"慢慢化开"而非"快速消失"。 */
          [data-preview-wallpaper] {
            animation: preview-wallpaper-in 1000ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          [data-preview-wallpaper].preview-wallpaper-out {
            animation: preview-wallpaper-out 2200ms cubic-bezier(0.33, 1, 0.68, 1) both;
            pointer-events: none;
          }

          @keyframes preview-wallpaper-in {
            from { opacity: 0; }
          }

          @keyframes preview-wallpaper-out {
            to { opacity: 0; }
          }

        `;

        const textNodesMatching = (node, value) =>
          Array.from(node.querySelectorAll("span")).filter((item) => item.textContent.trim() === value);

        const setWallpaperBlur = (doc, value) => {
          wallpaperBlur = Number(value);
          doc.documentElement.style.setProperty("--preview-wallpaper-blur", `${wallpaperBlur}px`);
          const output = doc.querySelector(".preview-wallpaper-blur-control output");
          if (output) output.value = `${wallpaperBlur} px`;
          const slider = doc.querySelector(".preview-blur-slider");
          if (slider) {
            const min = Number(slider.min) || 0;
            const max = Number(slider.max) || 16;
            const pct = ((wallpaperBlur - min) / (max - min)) * 100;
            slider.style.setProperty("--pct", `${pct}%`);
          }
        };

        const getBackgroundPanel = (doc) =>
          Array.from(doc.querySelectorAll(".ios-floating-menu")).find((node) =>
            node.textContent.includes("背景设置")
          );

        let wallpaperStyleDoc = null;
        let wallpaperStyleNode = null;
        let wallpaperStyleObserver = null;
        const installWallpaperStyleObserver = (doc, wallpaper) => {
          if (wallpaperStyleDoc === doc && wallpaperStyleNode === wallpaper) return;
          if (wallpaperStyleObserver) wallpaperStyleObserver.disconnect();
          wallpaperStyleDoc = doc;
          wallpaperStyleNode = wallpaper;
          wallpaperStyleObserver = null;
          const view = doc && doc.defaultView;
          if (!view || !wallpaper || typeof view.MutationObserver !== "function") return;
          wallpaperStyleObserver = new view.MutationObserver(() => {
            const root = doc.querySelector("#root > div");
            if (root) markWallpaper(doc, root);
          });
          wallpaperStyleObserver.observe(wallpaper, {
            attributes: true,
            attributeFilter: ["style"],
          });
        };

        const markWallpaper = (doc, root) => {
          const wallpaper = Array.from(root.querySelectorAll("div.fixed.inset-0.z-0")).find(
            (node) => node.style.backgroundImage
          );
          if (!wallpaper) {
            installWallpaperStyleObserver(doc, null);
            return null;
          }

          wallpaper.setAttribute("data-preview-wallpaper", "");
          if (wallpaper.style.getPropertyValue("--preview-wallpaper-image") !== wallpaper.style.backgroundImage) {
            wallpaper.style.setProperty("--preview-wallpaper-image", wallpaper.style.backgroundImage);
          }
          installWallpaperStyleObserver(doc, wallpaper);
          return wallpaper;
        };

        const addWallpaperBlurControl = (doc, wallpaper) => {
          const panel = getBackgroundPanel(doc);
          if (!panel) return;

          panel.setAttribute("data-preview-bg-panel", "");

          const importBtn = Array.from(panel.querySelectorAll("button")).find((node) => {
            const title = node.querySelector("div > div");
            return title && (title.textContent === "导入本地图片" || title.textContent === "已导入壁纸");
          });
          if (importBtn) {
            importBtn.setAttribute("data-preview-wallpaper-import", "");
            if (wallpaper) importBtn.setAttribute("data-preview-has-wallpaper", "");
            else importBtn.removeAttribute("data-preview-has-wallpaper");
          }

          const existing = panel.querySelector(".preview-wallpaper-blur-control");
          if (!wallpaper) {
            if (existing) existing.remove();
            return;
          }

          const wallpaperLabel = textNodesMatching(panel, "壁纸图片")[0];
          const wallpaperGroup = wallpaperLabel?.parentElement;
          if (!wallpaperGroup) return;
          if (existing) {
            if (wallpaperGroup.nextElementSibling !== existing) wallpaperGroup.after(existing);
            return;
          }

          const isLight = !!doc.body.dataset.previewLight;
          const control = doc.createElement("div");
          control.className = "preview-wallpaper-blur-control";

          const label = doc.createElement("div");
          label.className = "preview-wallpaper-blur-control__label flex items-center justify-between";

          const title = doc.createElement("span");
          title.className = `text-xs font-medium ${isLight ? "text-[#1a1625]/50" : "text-white/40"}`;
          title.textContent = "磨砂强度";
          const output = doc.createElement("output");
          output.className = `text-[10px] ${isLight ? "text-[#1a1625]/25" : "text-white/25"}`;
          output.value = `${wallpaperBlur} px`;
          label.append(title, output);

          const input = doc.createElement("input");
          input.className = "preview-blur-slider";
          input.type = "range";
          input.min = "0";
          input.max = "16";
          input.step = "1";
          input.value = String(wallpaperBlur);
          input.setAttribute("aria-label", "壁纸磨砂强度");
          input.addEventListener("input", () => setWallpaperBlur(doc, input.value));

          control.append(label, input);
          wallpaperGroup.after(control);
          setWallpaperBlur(doc, wallpaperBlur);
        };

        let previewThemeToneDoc = null;
        let previewThemeTone = null;
        const playThemeWash = (doc, tone) => {
          const view = doc.defaultView;
          if (!doc.body || !view || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

          let wash = doc.getElementById("preview-theme-wash");
          if (!wash) {
            wash = doc.createElement("div");
            wash.id = "preview-theme-wash";
            wash.className = "preview-theme-wash";
            wash.setAttribute("aria-hidden", "true");
            doc.body.appendChild(wash);
          }

          if (typeof wash.getAnimations === "function") {
            wash.getAnimations().forEach((animation) => animation.cancel());
          }
          if (typeof wash.animate !== "function") return;
          wash.style.backgroundColor = tone === "light" ? "#f0ece8" : "#1a1625";
          wash.animate(
            [{ opacity: 0.12 }, { opacity: 0 }],
            {
              duration: 220,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
          );
        };

        const syncLightMode = (doc, root) => {
          const isLight = root.classList.contains("bg-[#f0ece8]");
          const nextTone = isLight ? "light" : "dark";
          const toneChanged =
            previewThemeToneDoc === doc &&
            previewThemeTone !== null &&
            previewThemeTone !== nextTone;
          previewThemeToneDoc = doc;
          previewThemeTone = nextTone;

          if (isLight) doc.body.dataset.previewLight = "true";
          else delete doc.body.dataset.previewLight;

          // 黑夜模式 = 深底且无动态光效容器（动态模式才有 ambient-glow-container）
          const isDynamic = !!doc.querySelector(".ambient-glow-container");
          const isDarkNight = !isLight && !isDynamic;
          if (isDarkNight) doc.body.dataset.previewDarkMode = "true";
          else delete doc.body.dataset.previewDarkMode;

          const control = doc.querySelector(".preview-wallpaper-blur-control");
          if (control) {
            const title = control.querySelector(".preview-wallpaper-blur-control__label > span");
            const output = control.querySelector("output");
            if (title) title.className = `text-xs font-medium ${isLight ? "text-[#1a1625]/50" : "text-white/40"}`;
            if (output) output.className = `text-[10px] ${isLight ? "text-[#1a1625]/25" : "text-white/25"}`;
          }

          if (toneChanged) playThemeWash(doc, nextTone);
        };

        // —— 卡片左右两侧渐进模糊：严格复刻 GradualBlur 组件的层叠配方 ——
        // 7 层 div，每层一条渐变遮罩带 + 递增 backdrop-filter，
        // 遮罩带从边缘向内阶梯排布，叠加出“越靠边越糊”的连续渐变。
        const EDGE_BLUR_DIVS = 7;
        const EDGE_BLUR_STRENGTH = 1.2;

        const buildEdgeBlurDivs = (doc, position) => {
          const direction = position === "left" ? "to left" : "to right";
          const increment = 100 / EDGE_BLUR_DIVS;
          const divs = [];
          for (let i = 1; i <= EDGE_BLUR_DIVS; i++) {
            const progress = i / EDGE_BLUR_DIVS;
            const blur = 0.0625 * (progress * EDGE_BLUR_DIVS + 1) * EDGE_BLUR_STRENGTH;
            const p1 = Math.round((increment * i - increment) * 10) / 10;
            const p2 = Math.round(increment * i * 10) / 10;
            const p3 = Math.round((increment * i + increment) * 10) / 10;
            const p4 = Math.round((increment * i + increment * 2) * 10) / 10;
            let gradient = `transparent ${p1}%, black ${p2}%`;
            if (p3 <= 100) gradient += `, black ${p3}%`;
            if (p4 <= 100) gradient += `, transparent ${p4}%`;
            const div = doc.createElement("div");
            div.style.cssText =
              `-webkit-mask-image:linear-gradient(${direction},${gradient});` +
              `mask-image:linear-gradient(${direction},${gradient});` +
              `-webkit-backdrop-filter:blur(${blur.toFixed(3)}rem);` +
              `backdrop-filter:blur(${blur.toFixed(3)}rem);`;
            divs.push(div);
          }
          return divs;
        };

        const ensureEdgeBlurs = (doc) => {
          const carousel = doc.querySelector(".carousel-scrollbar-hidden");
          const rect = carousel ? carousel.getBoundingClientRect() : null;
          for (const side of ["left", "right"]) {
            const id = `preview-edge-blur-${side}`;
            const strip = doc.getElementById(id);
            if (!carousel) {
              if (strip) strip.remove();
              continue;
            }
            let node = strip;
            if (!node) {
              node = doc.createElement("div");
              node.id = id;
              node.className = "preview-edge-blur";
              node.style[side] = "0";
              for (const div of buildEdgeBlurDivs(doc, side)) node.appendChild(div);
              doc.body.appendChild(node);
            }
            node.style.top = `${Math.round(rect.top)}px`;
            node.style.height = `${Math.round(rect.height)}px`;
          }
        };

        let edgeBlurScrollDoc = null;
        let edgeBlurRaf = 0;
        const scheduleEdgeBlurs = (doc) => {
          if (edgeBlurRaf) return;
          const view = doc.defaultView;
          if (!view || typeof view.requestAnimationFrame !== "function") {
            ensureEdgeBlurs(doc);
            return;
          }
          const generation = previewGeneration;
          edgeBlurRaf = view.requestAnimationFrame(() => {
            if (generation !== previewGeneration) return;
            edgeBlurRaf = 0;
            ensureEdgeBlurs(doc);
          });
        };
        const installEdgeBlurScrollSync = (doc) => {
          if (edgeBlurScrollDoc === doc) return;
          const root = doc.querySelector("#root > div");
          const view = doc.defaultView;
          if (!root || !view) return;
          edgeBlurScrollDoc = doc;
          root.addEventListener("scroll", () => scheduleEdgeBlurs(doc), { passive: true });
          view.addEventListener("resize", () => scheduleEdgeBlurs(doc), { passive: true });
        };

        // —— annotate 慢路径：合并到逐帧一次 ——
        // 主题切换过渡期间 React 会连续多批渲染 → MutationObserver 高频回调。
        // ensureEdgeBlurs 每次 getBoundingClientRect（强制布局），
        // 同步逐批执行会明显增加主题切换期间的布局开销。
        // 折中：标注/主题/面板等"即时正确性"步骤保持同步（快路径），
        // 其余步骤放 rAF 收口，每帧至多执行一次。
        let sfHeavyDoc = null;
        let sfHeavyRaf = 0;
        const scheduleSfHeavy = (doc) => {
          sfHeavyDoc = doc;
          if (sfHeavyRaf) return;
          const view = doc.defaultView;
          const runHeavy = (d) => {
            if (!d || !d.body) return;
            const root = d.querySelector("#root > div");
            if (root) {
              addWallpaperBlurControl(d, markWallpaper(d, root));
              installEdgeBlurScrollSync(d);
              ensureCardNoise(d);
              ensureCardRevealStructure(d);
              wireCardTilt(d);
              tiltHealthCheck();
            }
            ensureEdgeBlurs(d);
          };
          if (!view || typeof view.requestAnimationFrame !== "function") {
            runHeavy(doc);
            return;
          }
          const generation = previewGeneration;
          sfHeavyRaf = view.requestAnimationFrame(() => {
            if (generation !== previewGeneration) return;
            sfHeavyRaf = 0;
            runHeavy(sfHeavyDoc);
          });
        };

        // —— 壁纸移除动效：React 卸载壁纸节点时克隆一份淡出。
        // 克隆保留 data-preview-wallpaper 属性，::before 磨砂层与 ::after 遮罩随整层一起淡出。
        const fadeOutWallpaper = (doc, node) => {
          const previous = doc.getElementById("preview-wallpaper-fade-out");
          if (previous) previous.remove();
          const clone = node.cloneNode(false);
          clone.id = "preview-wallpaper-fade-out";
          clone.classList.add("preview-wallpaper-out");
          doc.body.appendChild(clone);
          setTimeout(() => { if (clone.isConnected) clone.remove(); }, 2300);
        };

        // —— 噪点层注入：v6 参数（强度 3%），幂等重建。
        const NOISE_SVG_URI =
          "data:image/svg+xml," + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="160" height="160" filter="url(#n)" opacity="0.6"/></svg>`
          );

        const ensureCardNoise = (doc) => {
          // 样式恒定，仅在创建时写一次；React 替换卡片后新节点无噪声层则重建。
          // 不能每轮重复写 cssText：主题切换过渡期间 annotate 高频触发，
          // 重复拼接与写入对每张卡都是不必要的开销。
          const cards = doc.querySelectorAll(".motion-instance-card");
          cards.forEach((card) => {
            let n = card.querySelector(":scope > .preview-card-noise");
            if (n) return;
            n = doc.createElement("div");
            n.className = "preview-card-noise";
            n.setAttribute("aria-hidden", "true");
            n.style.cssText =
              "position:absolute;inset:0;z-index:1;pointer-events:none;" +
              "border-radius:inherit;mix-blend-mode:overlay;" +
              "background-image:url('" + NOISE_SVG_URI + "');" +
              "background-size:160px 160px;opacity:0.03;";
            card.insertBefore(n, card.firstChild);
          });
        };

        const ensureCardRevealStructure = (doc) => {
          const cards = doc.querySelectorAll(
            '.motion-instance-card[data-card-index]:not([data-card-index="0"])'
          );
          cards.forEach((card) => {
            const content = Array.from(card.children).find((node) =>
              node.classList &&
              node.classList.contains('relative') &&
              node.classList.contains('h-full') &&
              node.classList.contains('flex-col')
            );
            if (!content) return;

            const accordion = content.querySelector(':scope > .motion-accordion');
            const contentChildren = Array.from(content.children);
            const accordionIndex = contentChildren.indexOf(accordion);
            if (!accordion || accordionIndex < 2) return;

            const subtitle = contentChildren[accordionIndex - 2];
            subtitle.classList.add('preview-card-subtitle');
            contentChildren[accordionIndex - 1].classList.add('preview-card-status');

            const detailList = accordion.querySelector('.motion-accordion-inner > div');
            if (!detailList) return;

            const detailHeight = Math.ceil(detailList.scrollHeight || 0);
            const detailTop = content.clientHeight - 14 - detailHeight;
            const expandedTitleHeight = 20;
            const rawTitleLift = detailTop - 8 - expandedTitleHeight - subtitle.offsetTop;
            const titleLift = Math.max(-96, Math.min(-60, Math.round(rawTitleLift)));
            const titleLiftValue = `${titleLift}px`;
            if (content.style.getPropertyValue('--card-title-lift') !== titleLiftValue) {
              content.style.setProperty('--card-title-lift', titleLiftValue);
            }

            if (accordion.classList.contains('is-open')) {
              accordion.removeAttribute('inert');
            } else {
              accordion.setAttribute('inert', '');
            }
          });
        };

        // —— 卡片轻微 3D 倾斜跟随鼠标（隔离架构）：
        // 每张卡片 transform 自带 perspective(900px)，透视原点=卡心，
        // 等价于给每张卡一个紧贴自身的隐形工作框架（参考页的
        // .glass-stage 就是这么干的，只是它只有一张卡）。
        // 轨道（轮播容器）不再持有任何 perspective/perspective-origin——
        // 共享 3D 空间会在悬停切换时让所有带 transform 的卡片投影跳变。
        const TILT_MAX_DEG = 6;
        let tiltWiredDoc = null;
        let tiltCard = null;
        let tiltTrack = null;

        // React 重渲染会整节点替换被倾斜的卡片（transform 随节点消亡），
        // 但轨道的 snap 关闭状态会残留——每次标注时做健康检查。
        const tiltHealthCheck = () => {
          if (tiltCard && !tiltCard.isConnected && tiltTrack) {
            tiltTrack.style.scrollSnapType = "";
            tiltTrack = null;
            tiltCard = null;
          }
        };

        const wireCardTilt = (doc) => {
          if (tiltWiredDoc === doc) return;
          const view = doc.defaultView;
          if (!view) return;
          if (view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
          tiltWiredDoc = doc;

          const setTilt = (card, tilt) => {
            if (tiltCard && tiltCard !== card && tiltCard.isConnected) {
              tiltCard.style.setProperty("--tilt-dur", "400ms");
              tiltCard.style.removeProperty("--preview-tilt");
              tiltCard.style.transform = "";
            }
            tiltCard = tilt ? card : null;
            // 倾斜期间临时关闭轨道 scroll-snap：旋转会改变卡片的 snap
            // 区域，Chrome 的 snap-mandatory 会立刻重吸附，把整条轨道
            // 平移 1px——邻卡"跟着晃"的直接元凶。回正后立即恢复 snap。
            const track = tilt && card ? card.parentElement : tiltTrack;
            if (tilt && track) {
              tiltTrack = track;
              track.style.scrollSnapType = "none";
            } else if (tiltTrack) {
              tiltTrack.style.scrollSnapType = "";
              tiltTrack = null;
            }
            if (!card) return;
            if (tilt) {
              card.style.setProperty("--tilt-dur", "0ms");
              card.style.setProperty("--preview-tilt", tilt);
              card.style.transform = tilt;
            } else {
              card.style.setProperty("--tilt-dur", "400ms");
              card.style.removeProperty("--preview-tilt");
              card.style.transform = "";
            }
          };

          // 平面几何（不含 transform）：用 offset 系 + 轨道 rect 计算。
          // 关键修复：倾斜归一化与出界判断都必须基于"未旋转"的 rect——
          // 若用 getBoundingClientRect（含旋转），卡片一转 rect 就偏，
          // 鼠标坐标被反馈进旋转角，形成自激振荡（乱晃）。
          const getFlatRect = (card) => {
            const track = card.parentElement;
            const tr = track.getBoundingClientRect();
            const left = tr.left + card.offsetLeft - track.scrollLeft;
            const top = tr.top + card.offsetTop - track.scrollTop;
            const w = card.offsetWidth;
            const h = card.offsetHeight;
            return { left, top, width: w, height: h, right: left + w, bottom: top + h };
          };

          doc.addEventListener("pointermove", (e) => {
            // 倾斜是鼠标悬停视效；触摸/笔拖动轮播时不触发。
            if (e.pointerType && e.pointerType !== "mouse") return;
            const card = e.target && e.target.closest ? e.target.closest(".motion-instance-card") : null;
            if (!card) return;
            const f = getFlatRect(card);
            if (e.clientX < f.left || e.clientX > f.right || e.clientY < f.top || e.clientY > f.bottom) return;
            // 每张卡片自带独立透视空间（工作框架），不动轨道任何共享样式。
            const x = (e.clientX - f.left) / f.width - 0.5;
            const y = (e.clientY - f.top) / f.height - 0.5;
            // 幅度实时读调试面板写入的 --sf-tilt-max（0 也有效，用于关闭倾斜）
            const rawDeg = parseFloat(doc.documentElement.style.getPropertyValue("--sf-tilt-max"));
            const deg = Number.isFinite(rawDeg) ? rawDeg : TILT_MAX_DEG;
            const tilt = `perspective(900px) rotateY(${(x * deg).toFixed(2)}deg) rotateX(${(-y * deg).toFixed(2)}deg)`;
            setTilt(card, tilt);
          }, { passive: true });

          doc.addEventListener("pointerout", (e) => {
            const card = e.target && e.target.closest ? e.target.closest(".motion-instance-card") : null;
            if (!card || card.contains(e.relatedTarget)) return;
            // 旋转会把卡片边缘从光标下挪走，触发假性 pointerout；
            // 光标仍在平面 rect 内时忽略，只有真正离开才回正。
            if (e.relatedTarget) {
              const f = getFlatRect(card);
              if (e.clientX >= f.left && e.clientX <= f.right && e.clientY >= f.top && e.clientY <= f.bottom) return;
            }
            setTilt(card, "");
          }, { passive: true });
        };

        const syncTuningPanelVisibility = (doc, panel) => {
          if (!doc || !doc.body) return;
          const target = panel || doc.querySelector(".preview-tuning-panel");
          if (!target) return;
          target.dataset.previewConcealed = String(tuningPanelConcealed);
          target.setAttribute("aria-hidden", String(tuningPanelConcealed));
          if (tuningPanelConcealed && typeof target.__sfCloseColorPop === "function") {
            target.__sfCloseColorPop();
          }
        };

        const wireTuningPanelLongPress = (doc) => {
          const island = doc.querySelector("header.fixed.left-0.right-0.z-50 > div.h-12");
          const button = island && island.querySelector(":scope > button.motion-control.ios-glass-btn");
          if (!button || button.dataset.previewTuningPressWired === "1") return;
          const view = doc.defaultView;
          if (!view) return;

          button.dataset.previewTuningPressWired = "1";
          let timer = 0;
          let pointerId = null;
          let startX = 0;
          let startY = 0;
          let consumeClick = false;
          let consumeTimer = 0;

          const cancelPress = () => {
            if (timer) view.clearTimeout(timer);
            timer = 0;
            pointerId = null;
          };

          button.addEventListener("pointerdown", (event) => {
            if (!event.isPrimary) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            cancelPress();
            consumeClick = false;
            startX = event.clientX;
            startY = event.clientY;
            pointerId = event.pointerId;
            timer = view.setTimeout(() => {
              timer = 0;
              if (!button.isConnected || frame.contentDocument !== doc) return;
              tuningPanelConcealed = !tuningPanelConcealed;
              syncTuningPanelVisibility(doc);
              consumeClick = true;
              if (consumeTimer) view.clearTimeout(consumeTimer);
              consumeTimer = view.setTimeout(() => {
                consumeClick = false;
                consumeTimer = 0;
              }, 1000);
            }, TUNING_PANEL_LONG_PRESS_MS);
          });

          button.addEventListener("pointermove", (event) => {
            if (!timer || event.pointerId !== pointerId) return;
            if (Math.hypot(event.clientX - startX, event.clientY - startY) > TUNING_PANEL_LONG_PRESS_MOVE_PX) {
              cancelPress();
            }
          });

          ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach((type) => {
            button.addEventListener(type, cancelPress);
          });

          button.addEventListener("click", (event) => {
            if (!consumeClick) return;
            consumeClick = false;
            if (consumeTimer) view.clearTimeout(consumeTimer);
            consumeTimer = 0;
            event.preventDefault();
            event.stopImmediatePropagation();
          }, true);
        };

        const annotatePreview = (doc) => {
          const root = doc.querySelector("#root > div");
          if (!root || !doc.body) return;

          root.setAttribute("data-preview-root", "");
          const main = root.querySelector(":scope > main");
          if (main) {
            const logo = main.querySelector(":scope > div.mb-4.text-center.select-none.cursor-pointer.group");
            if (logo) logo.setAttribute("data-preview-logo", "");
          }

          syncLightMode(doc, root);
          installThemeRootObserver(doc, root);
          installThemeIntentCapture(doc);
          // 仅保留防闪标注与即时正确性步骤：
          // 主题 dataset（syncLightMode）、壁纸标注、面板/预设 tick。
          // 其余全部进 rAF 慢活（scheduleSfHeavy），切换过渡的多批渲染
          // 不再每批都做面板扫描/控件绑定/噪声层写入等重复工作。
          markWallpaper(doc, root);
          ensureTuningPanel(doc);
          wireTuningPanelLongPress(doc);
          scheduleSfHeavy(doc);
        };

        // —— 柔焦参数调试面板（临时）：
        // 挂在 iframe 文档 body 上（fixed 定位），React 重渲染不会碰它。
        // 值写入 documentElement 的 CSS 变量，三个主题规则共享，即时生效。
        // 面板可整体拖动（按住标题栏）；所有项含 RGB 颜色。
        // 覆盖卡片全部可调项：材质/发光/外阴影/内部图片/遮罩/渐变/倾斜。
        const deepFreezeSfDefaults = (value) => {
          if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
          for (const child of Object.values(value)) deepFreezeSfDefaults(child);
          return Object.freeze(value);
        };

        // 用户于 2026-09-04 确认的三套初始基线。运行时只能克隆使用，
        // 用户草稿、保存槽和历史均存入独立对象，绝不反写这些常量。
        const SF_MODE_DEFAULTS = deepFreezeSfDefaults({
          dynamic: {
            blur: 1, sat: 143, radius: 26, fog: 2, noise: 0,
            glow1: 5, glow2: 5, glow1Spread: 41, glow2Spread: 81,
            shY: 7, shBlur: 26, shA: 26,
            imgOp: 100, imgBri: 100, imgSat: 100, imgBlur: 0,
            cover: 16,
            gradBc: 97, gradBe: 100, gradHc: 41, gradHe: 74,
            lgBc: 26, lgBe: 96, lgHc: 75, lgHe: 82,
            tiltMax: 7,
            fogRgb: [255, 250, 252],
            glow1Rgb: [191, 82, 90],
            glow2Rgb: [231, 141, 167],
            coverRgb: [18, 16, 20],
            gradRgb: [30, 15, 24],
            lgRgb: [244, 240, 237],
            shRgb: [7, 5, 10],
          },
          light: {
            blur: 1, sat: 143, radius: 26, fog: 2, noise: 0,
            glow1: 48, glow2: 27, glow1Spread: 41, glow2Spread: 81,
            shY: 7, shBlur: 26, shA: 26,
            imgOp: 100, imgBri: 100, imgSat: 100, imgBlur: 0,
            cover: 7,
            gradBc: 97, gradBe: 100, gradHc: 74, gradHe: 94,
            lgBc: 83, lgBe: 97, lgHc: 22, lgHe: 76,
            tiltMax: 7,
            fogRgb: [171, 168, 169],
            glow1Rgb: [255, 255, 255],
            glow2Rgb: [255, 255, 255],
            coverRgb: [192, 192, 192],
            gradRgb: [30, 15, 24],
            lgRgb: [252, 252, 252],
            shRgb: [7, 5, 10],
          },
          dark: {
            blur: 1, sat: 136, radius: 26, fog: 2, noise: 0,
            glow1: 3, glow2: 14, glow1Spread: 23, glow2Spread: 53,
            shY: 7, shBlur: 26, shA: 37.5,
            imgOp: 100, imgBri: 117, imgSat: 100, imgBlur: 0,
            cover: 28,
            gradBc: 71, gradBe: 79, gradHc: 36, gradHe: 73,
            lgBc: 26, lgBe: 96, lgHc: 75, lgHe: 74,
            tiltMax: 7,
            fogRgb: [249, 255, 249],
            glow1Rgb: [36, 18, 76],
            glow2Rgb: [91, 79, 118],
            coverRgb: [31, 31, 31],
            gradRgb: [14, 7, 30],
            lgRgb: [244, 240, 237],
            shRgb: [7, 5, 10],
          },
        });

        // 三种模式各自拥有独立工作区、手动保存槽和历史，任何修改只写入
        // 面板当前模式。旧版 dynamic 裸对象与三个旧槽会按模式一次性兼容读取。
        const SF_STORAGE_VERSION = 3;
        const SF_BASELINE_REVISION = "20260904-card-reveal-v10";
        const SF_BASELINE_REVISION_KEY = "sillyclient.sfTuningPreset.baselineRevision";
        const SF_MODE_LABELS = {
          dynamic: "动态",
          light: "白天",
          dark: "黑夜",
        };
        const SF_MODE_ORDER = ["dynamic", "light", "dark"];
        const SF_LEGACY_DYNAMIC_KEY = "sillyclient.sfTuningPreset.dynamic";
        const SF_DRAFT_KEYS = {
          dynamic: "sillyclient.sfTuningPreset.draft.dynamic",
          light: "sillyclient.sfTuningPreset.draft.light",
          dark: "sillyclient.sfTuningPreset.draft.dark",
        };
        const SF_SLOT_KEYS = {
          dynamic: "sillyclient.sfTuningPreset.slot.dynamic",
          light: "sillyclient.sfTuningPreset.slot.light",
          dark: "sillyclient.sfTuningPreset.slot.dark",
        };
        const SF_HISTORY_KEYS = {
          dynamic: "sillyclient.sfTuningPreset.history.dynamic",
          light: "sillyclient.sfTuningPreset.history.light",
          dark: "sillyclient.sfTuningPreset.history.dark",
        };
        const normalizeSfMode = (mode) => SF_MODE_ORDER.includes(mode) ? mode : "dynamic";
        const cloneSfValues = (value) => JSON.parse(JSON.stringify(value));
        const sfDefaultValues = (mode) => cloneSfValues(SF_MODE_DEFAULTS[normalizeSfMode(mode)]);
        const normalizeSfValues = (raw, mode = "dynamic") => {
          if (!raw || typeof raw !== "object") return null;
          const defaults = SF_MODE_DEFAULTS[normalizeSfMode(mode)];
          const merged = sfDefaultValues(mode);
          let accepted = false;
          for (const key of Object.keys(defaults)) {
            if (raw[key] === undefined || raw[key] === null) continue;
            if (Array.isArray(defaults[key])) {
              if (!Array.isArray(raw[key]) || raw[key].length < 3) continue;
              const rgb = raw[key].slice(0, 3).map((value) => Number(value));
              if (rgb.some((value) => !Number.isFinite(value))) continue;
              merged[key] = rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))));
            } else {
              const value = Number(raw[key]);
              if (!Number.isFinite(value)) continue;
              merged[key] = value;
            }
            accepted = true;
          }
          return accepted ? merged : null;
        };
        const readSfJson = (key) => {
          try {
            const raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
          } catch (err) {
            return null;
          }
        };
        const writeSfJson = (key, value) => {
          try {
            window.localStorage.setItem(key, JSON.stringify(value));
            return true;
          } catch (err) {
            return false;
          }
        };
        const removeSfJson = (key) => {
          try {
            window.localStorage.removeItem(key);
          } catch (err) {
            /* 存储不可用时静默跳过 */
          }
        };
        const normalizeSfRecord = (raw, mode) => {
          if (!raw || typeof raw !== "object") return null;
          mode = normalizeSfMode(mode);
          const values = normalizeSfValues(raw.values && typeof raw.values === "object" ? raw.values : raw, mode);
          if (!values) return null;
          return {
            version: SF_STORAGE_VERSION,
            id: typeof raw.id === "string" ? raw.id : null,
            mode,
            savedAt: Number.isFinite(Number(raw.savedAt)) ? Number(raw.savedAt) : null,
            updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : null,
            values,
          };
        };
        const loadSfSlotRecord = (mode) => normalizeSfRecord(readSfJson(SF_SLOT_KEYS[mode]), mode);
        const loadSfHistory = (mode) => {
          const raw = readSfJson(SF_HISTORY_KEYS[mode]);
          if (!Array.isArray(raw)) return [];
          return raw
            .map((item) => normalizeSfRecord(item, mode))
            .filter((item) => item && item.savedAt)
            .sort((a, b) => b.savedAt - a.savedAt)
            .slice(0, 24);
        };
        const saveSfHistory = (mode, history) =>
          writeSfJson(SF_HISTORY_KEYS[mode], history.slice(0, 24));

        // 旧 runtime 会优先恢复自动草稿，从而盖过已经写入代码的获批基线。
        // 这里只迁移旧版草稿；显式保存槽与历史不删除，也不改写其数值。
        const migrateSfDraftsToApprovedBaseline = () => {
          let appliedRevision = null;
          try {
            appliedRevision = window.localStorage.getItem(SF_BASELINE_REVISION_KEY);
          } catch (err) {
            return;
          }
          if (appliedRevision === SF_BASELINE_REVISION) return;

          for (const mode of SF_MODE_ORDER) {
            const rawDraft = readSfJson(SF_DRAFT_KEYS[mode]);
            const draftVersion = Number(rawDraft && rawDraft.version);
            if (Number.isFinite(draftVersion) && draftVersion >= SF_STORAGE_VERSION) continue;
            const slot = loadSfSlotRecord(mode);
            writeSfJson(SF_DRAFT_KEYS[mode], {
              version: SF_STORAGE_VERSION,
              id: "draft-" + mode,
              mode,
              updatedAt: Date.now(),
              values: slot ? cloneSfValues(slot.values) : sfDefaultValues(mode),
            });
          }

          try {
            window.localStorage.setItem(SF_BASELINE_REVISION_KEY, SF_BASELINE_REVISION);
          } catch (err) {
            /* 存储不可用时保持内置默认回退 */
          }
        };
        migrateSfDraftsToApprovedBaseline();

        const sfDraftCache = Object.create(null);
        const sfDraftSaveTimers = Object.create(null);
        const loadSfDraftRecord = (mode) => {
          mode = normalizeSfMode(mode);
          const current = normalizeSfRecord(readSfJson(SF_DRAFT_KEYS[mode]), mode);
          if (current) return current;

          const legacy = mode === "dynamic"
            ? normalizeSfRecord(readSfJson(SF_LEGACY_DYNAMIC_KEY), mode)
            : null;
          const slot = loadSfSlotRecord(mode);
          const source = legacy || slot;
          const record = {
            version: SF_STORAGE_VERSION,
            id: "draft-" + mode,
            mode,
            updatedAt: Date.now(),
            values: source ? cloneSfValues(source.values) : sfDefaultValues(mode),
          };
          writeSfJson(SF_DRAFT_KEYS[mode], record);
          return record;
        };
        const loadSfModeValues = (mode) => {
          mode = normalizeSfMode(mode);
          if (!sfDraftCache[mode]) sfDraftCache[mode] = cloneSfValues(loadSfDraftRecord(mode).values);
          return cloneSfValues(sfDraftCache[mode]);
        };
        const saveSfDraftNow = (mode, values) => {
          if (!SF_MODE_ORDER.includes(mode)) return false;
          const next = normalizeSfValues(values, mode);
          if (!next) return false;
          sfDraftCache[mode] = cloneSfValues(next);
          if (sfDraftSaveTimers[mode]) {
            window.clearTimeout(sfDraftSaveTimers[mode]);
            sfDraftSaveTimers[mode] = 0;
          }
          return writeSfJson(SF_DRAFT_KEYS[mode], {
            version: SF_STORAGE_VERSION,
            id: "draft-" + mode,
            mode,
            updatedAt: Date.now(),
            values: next,
          });
        };
        const scheduleSfDraftSave = (mode, values) => {
          if (!SF_MODE_ORDER.includes(mode)) return;
          const next = normalizeSfValues(values, mode);
          if (!next) return;
          sfDraftCache[mode] = cloneSfValues(next);
          if (sfDraftSaveTimers[mode]) window.clearTimeout(sfDraftSaveTimers[mode]);
          sfDraftSaveTimers[mode] = window.setTimeout(() => {
            sfDraftSaveTimers[mode] = 0;
            saveSfDraftNow(mode, sfDraftCache[mode]);
          }, 180);
        };
        const saveSfSnapshot = (mode, values) => {
          const next = normalizeSfValues(values, mode);
          if (!next) return null;
          const now = Date.now();
          const record = {
            version: SF_STORAGE_VERSION,
            id: now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
            mode,
            savedAt: now,
            updatedAt: now,
            values: next,
          };
          const signature = JSON.stringify(record.values);
          const history = loadSfHistory(mode).filter(
            (item) => item.id !== record.id && JSON.stringify(item.values) !== signature
          );
          history.unshift(record);
          writeSfJson(SF_SLOT_KEYS[mode], record);
          saveSfHistory(mode, history);
          saveSfDraftNow(mode, record.values);
          return record;
        };
        const restoreSfSnapshot = (mode, record) => {
          const normalized = normalizeSfRecord(record, mode);
          if (!normalized) return null;
          writeSfJson(SF_SLOT_KEYS[mode], normalized);
          saveSfDraftNow(mode, normalized.values);
          return normalized;
        };
        const deleteSfSnapshot = (mode, id) => {
          const history = loadSfHistory(mode).filter((record) => record.id !== id);
          saveSfHistory(mode, history);
          const slot = loadSfSlotRecord(mode);
          if (slot && slot.id === id) {
            if (history[0]) writeSfJson(SF_SLOT_KEYS[mode], history[0]);
            else removeSfJson(SF_SLOT_KEYS[mode]);
          }
          return history;
        };
        const formatSfTime = (timestamp, compact) => {
          if (!timestamp) return "未保存";
          const date = new Date(timestamp);
          const pad = (value) => String(value).padStart(2, "0");
          const day = pad(date.getMonth() + 1) + "-" + pad(date.getDate());
          const time = pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
          return compact ? day + " " + time : date.getFullYear() + "-" + day + " " + time;
        };
        const sfFileStamp = (timestamp) => {
          const date = new Date(timestamp || Date.now());
          const pad = (value) => String(value).padStart(2, "0");
          return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + "-" +
            pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
        };
        const downloadSfJson = (doc, filename, payload) => {
          const view = doc.defaultView;
          if (!view || typeof view.Blob !== "function" || !view.URL ||
              typeof view.URL.createObjectURL !== "function") return false;
          const blob = new view.Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
          const url = view.URL.createObjectURL(blob);
          const link = doc.createElement("a");
          link.href = url;
          link.download = filename;
          link.style.display = "none";
          doc.body.appendChild(link);
          link.click();
          link.remove();
          view.setTimeout(() => view.URL.revokeObjectURL(url), 1000);
          return true;
        };

        // 高频滑动只更新内存并做 180ms 尾随落盘，避免同步 localStorage
        // 写入阻塞色盘与滑块。目标模式取自面板自身，不再从瞬态 DOM 猜测。
        const sfRemember = (doc, values) => {
          const panel = doc && doc.querySelector(".preview-tuning-panel");
          const mode = panel && SF_MODE_ORDER.includes(panel.__sfMode)
            ? panel.__sfMode
            : sfThemeModeOf(doc) || "dynamic";
          scheduleSfDraftSave(mode, values);
          if (panel && typeof panel.__sfMarkDirty === "function") panel.__sfMarkDirty();
        };

        let sfAppliedDoc = null;
        let sfAppliedSig = "";
        const applySfVars = (doc, v) => {
          // 去重：主题切换过渡期间 annotate 每批都会带同一份 vals 进来，
          // 值没变就不重复写 20+ 个 CSS 变量（省掉整批样式写开销）。
          const sig = JSON.stringify(v);
          if (doc === sfAppliedDoc && sig === sfAppliedSig) return;
          sfAppliedDoc = doc;
          sfAppliedSig = sig;
          const el = doc.documentElement;
          el.style.setProperty("--sf-blur", v.blur + "px");
          el.style.setProperty("--sf-sat", String(v.sat / 100));
          el.style.setProperty("--sf-radius", v.radius + "px");
          el.style.setProperty("--sf-fog", String(v.fog / 100));
          el.style.setProperty("--sf-noise", String(v.noise / 100));
          el.style.setProperty("--sf-glow1", String(v.glow1 / 100));
          el.style.setProperty("--sf-glow2", String(v.glow2 / 100));
          el.style.setProperty("--sf-glow1-spread", v.glow1Spread + "px");
          el.style.setProperty("--sf-glow2-spread", v.glow2Spread + "px");
          el.style.setProperty("--sf-sh-y", v.shY + "px");
          el.style.setProperty("--sf-sh-blur", v.shBlur + "px");
          el.style.setProperty("--sf-sh-a", String(v.shA / 100));
          el.style.setProperty("--sf-sh-rgb", v.shRgb.join(" "));
          el.style.setProperty("--sf-img-op", String(v.imgOp / 100));
          el.style.setProperty("--sf-img-bri", String(v.imgBri / 100));
          el.style.setProperty("--sf-img-sat", String(v.imgSat / 100));
          el.style.setProperty("--sf-img-blur", v.imgBlur + "px");
          el.style.setProperty("--sf-cover", String(v.cover / 100));
          el.style.setProperty("--sf-grad-bc", String(v.gradBc / 100));
          el.style.setProperty("--sf-grad-be", String(v.gradBe / 100));
          el.style.setProperty("--sf-grad-hc", v.gradHc + "%");
          el.style.setProperty("--sf-grad-he", v.gradHe + "%");
          el.style.setProperty("--sf-grad-rgb", v.gradRgb.join(" "));
          el.style.setProperty("--sf-lg-bc", String(v.lgBc / 100));
          el.style.setProperty("--sf-lg-be", String(v.lgBe / 100));
          el.style.setProperty("--sf-lg-hc", v.lgHc + "%");
          el.style.setProperty("--sf-lg-he", v.lgHe + "%");
          el.style.setProperty("--sf-lg-rgb", v.lgRgb.join(" "));
          el.style.setProperty("--sf-tilt-max", String(v.tiltMax));
          el.style.setProperty("--sf-fog-rgb", v.fogRgb.join(" "));
          el.style.setProperty("--sf-glow1-rgb", v.glow1Rgb.join(" "));
          el.style.setProperty("--sf-glow2-rgb", v.glow2Rgb.join(" "));
          el.style.setProperty("--sf-cover-rgb", v.coverRgb.join(" "));
        };

        // —— 主题联动：三套独立工作区固定切换，目标模式没有历史时也会
        // 使用自己的默认副本，绝不继续沿用上一模式的 vals。
        let sfAppliedTheme = null;
        let sfAppliedThemeDoc = null;
        let sfPendingTheme = null;
        let sfPendingThemeUntil = 0;
        let sfPendingThemeDoc = null;
        let sfPendingThemeTimer = 0;
        let sfPendingThemeTimerView = null;
        const clearSfPendingTheme = () => {
          if (sfPendingThemeTimer && sfPendingThemeTimerView) {
            sfPendingThemeTimerView.clearTimeout(sfPendingThemeTimer);
          }
          sfPendingTheme = null;
          sfPendingThemeUntil = 0;
          sfPendingThemeDoc = null;
          sfPendingThemeTimer = 0;
          sfPendingThemeTimerView = null;
        };
        const sfThemeModeOf = (doc) => {
          const b = doc.body;
          if (!b) return null;
          if (b.dataset.previewLight !== undefined) return "light";
          if (b.dataset.previewDarkMode !== undefined) return "dark";
          return "dynamic";
        };
        const sfThemeTick = (doc) => {
          const panel = doc.querySelector(".preview-tuning-panel");
          if (!panel || typeof panel.__sfSwitchMode !== "function") return;
          const mode = sfThemeModeOf(doc);
          if (!mode) return;
          if (sfAppliedThemeDoc !== doc) {
            sfAppliedThemeDoc = doc;
            sfAppliedTheme = null;
            if (sfPendingThemeDoc !== doc) clearSfPendingTheme();
          }
          if (sfPendingTheme && sfPendingThemeDoc === doc) {
            if (mode === sfPendingTheme) {
              clearSfPendingTheme();
            } else if (Date.now() < sfPendingThemeUntil) {
              return;
            } else {
              clearSfPendingTheme();
            }
          }
          if (mode === sfAppliedTheme && panel.__sfMode === mode) return;
          sfAppliedTheme = mode;
          panel.__sfSwitchMode(mode);
        };

        let sfThemeSwitchTimer = 0;
        const beginSfThemeSwitch = (doc, mode) => {
          if (!SF_MODE_ORDER.includes(mode)) return;
          const panel = doc.querySelector(".preview-tuning-panel");
          const actualMode = sfThemeModeOf(doc);
          if (actualMode === mode && (!panel || panel.__sfMode === mode)) return;
          clearSfPendingTheme();
          sfPendingTheme = mode;
          sfPendingThemeUntil = Date.now() + 1500;
          sfPendingThemeDoc = doc;
          const view = doc.defaultView;
          if (!view) return;
          sfPendingThemeTimerView = view;
          sfPendingThemeTimer = view.setTimeout(() => {
            sfPendingThemeTimer = 0;
            sfPendingThemeTimerView = null;
            if (sfPendingThemeDoc !== doc || sfPendingTheme !== mode) return;
            sfPendingTheme = null;
            sfPendingThemeUntil = 0;
            sfPendingThemeDoc = null;
            const root = doc.querySelector("#root > div");
            if (!root) return;
            syncLightMode(doc, root);
            ensureTuningPanel(doc);
          }, 1550);
          doc.documentElement.classList.add("preview-theme-switching");
          if (sfThemeSwitchTimer) view.clearTimeout(sfThemeSwitchTimer);
          sfThemeSwitchTimer = view.setTimeout(() => {
            sfThemeSwitchTimer = 0;
            doc.documentElement.classList.remove("preview-theme-switching");
          }, 240);
        };

        const ensureTuningPanel = (doc) => {
          // React 重渲染后节点若被移除则重建；已存在则只同步变量（幂等）
          let panel = doc.querySelector(".preview-tuning-panel");
          const mode = sfThemeModeOf(doc) || "dynamic";
          const vals = panel && panel.__sfValues
            ? panel.__sfValues
            : loadSfModeValues(mode);
          applySfVars(doc, vals);
          if (panel) {
            panel.__sfValues = vals;
            syncTuningPanelVisibility(doc, panel);
            sfThemeTick(doc);
            return;
          }
          if (!doc.body) return;

          panel = doc.createElement("div");
          panel.className = "preview-tuning-panel preview-tuning-panel--draggable";
          panel.__sfValues = vals;
          panel.__sfMode = mode;
          syncTuningPanelVisibility(doc, panel);
          panel.style.right = "16px";
          panel.style.top = "50%";
          panel.style.left = "auto";
          panel.style.transform = "translateY(-50%)";

          const h3 = doc.createElement("h3");
          h3.textContent = "柔焦参数";
          h3.style.cursor = "move";
          h3.title = "拖动移动面板";
          const resetBtn = doc.createElement("button");
          resetBtn.type = "button";
          resetBtn.textContent = "重置";
          h3.appendChild(resetBtn);
          panel.appendChild(h3);

          // —— 面板拖动（按住标题栏）
          const view = doc.defaultView;
          let dragOff = null;
          const setPanelPosition = (left, top) => {
            const width = panel.offsetWidth;
            const height = panel.offsetHeight;
            const maxLeft = Math.max(8, view.innerWidth - width - 8);
            const maxTop = Math.max(8, view.innerHeight - height - 8);
            panel.style.left = Math.min(maxLeft, Math.max(8, left)) + "px";
            panel.style.top = Math.min(maxTop, Math.max(8, top)) + "px";
            panel.style.right = "auto";
            panel.style.transform = "none";
          };
          const constrainPanel = () => {
            if (panel.style.transform !== "none") return;
            const rect = panel.getBoundingClientRect();
            setPanelPosition(rect.left, rect.top);
          };
          panel.__sfConstrain = constrainPanel;
          h3.addEventListener("pointerdown", (e) => {
            if (e.target.closest("button, input, summary, a")) return;
            dragOff = { x: e.clientX, y: e.clientY };
            const r = panel.getBoundingClientRect();
            dragOff.px = r.left; dragOff.py = r.top;
            try { h3.setPointerCapture && h3.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件无活动指针，忽略 */ }
            e.preventDefault();
          });
          h3.addEventListener("pointermove", (e) => {
            if (!dragOff) return;
            const nx = dragOff.px + e.clientX - dragOff.x;
            const ny = dragOff.py + e.clientY - dragOff.y;
            setPanelPosition(nx, ny);
          });
          ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) =>
            h3.addEventListener(t, () => { dragOff = null; }));
          view.addEventListener("resize", constrainPanel, { passive: true });

          const sliders = [];
          const rgbRows = [];
          const valueOut = doc.createElement("div");
          valueOut.className = "preview-tuning-values";
          const hex = (a) => "#" + a.map((n) => n.toString(16).padStart(2, "0")).join("");

          // 全参数回显（拷贝回 CSS 用）
          const renderReadout = () => {
            valueOut.textContent =
              "blur " + vals.blur + "px · sat " + vals.sat + "% · r " + vals.radius + "px\n" +
              "fog " + vals.fog + "% · noise " + vals.noise + "%\n" +
              "g1 " + vals.glow1 + "%/" + vals.glow1Spread + "px · g2 " + vals.glow2 + "%/" + vals.glow2Spread + "px\n" +
              "影 y" + vals.shY + " b" + vals.shBlur + " a" + vals.shA + "%\n" +
              "图 op" + vals.imgOp + " bri" + vals.imgBri + " sat" + vals.imgSat + " blu" + vals.imgBlur + "\n" +
              "遮罩 " + vals.cover + "% · 倾斜 " + vals.tiltMax + "°\n" +
              "渐变 收" + vals.gradBc + "/" + vals.gradHc + " 展" + vals.gradBe + "/" + vals.gradHe + "\n" +
              "渐变浅 收" + vals.lgBc + "/" + vals.lgHc + " 展" + vals.lgBe + "/" + vals.lgHe + "\n" +
              "雾" + hex(vals.fogRgb) + " 发1" + hex(vals.glow1Rgb) + " 发2" + hex(vals.glow2Rgb) + "\n" +
              "罩" + hex(vals.coverRgb) + " 渐" + hex(vals.gradRgb) + "\n" +
              "浅渐" + hex(vals.lgRgb) + " 影" + hex(vals.shRgb);
          };

          const addSection = (title) => {
            const s = doc.createElement("div");
            s.className = "preview-tuning-section";
            s.textContent = title;
            panel.appendChild(s);
          };

          const addSlider = (key, label, min, max, unit, scale, step) => {
            const row = doc.createElement("div");
            row.className = "preview-tuning-row";
            const lab = doc.createElement("label");
            lab.textContent = label;
            const out = doc.createElement("output");
            const readVal = () => scale ? vals[key] / scale : vals[key];
            out.textContent = readVal() + unit;
            row.append(lab, out);
            const input = doc.createElement("input");
            input.type = "range";
            input.min = String(min * (scale || 1));
            input.max = String(max * (scale || 1));
            input.step = String(step || 1);
            input.value = String(vals[key]);
            const syncPct = () => {
              const pct = ((vals[key] - min * (scale || 1)) / ((max - min) * (scale || 1))) * 100;
              input.style.setProperty("--pct", pct.toFixed(1) + "%");
            };
            syncPct();
            input.addEventListener("input", () => {
              vals[key] = Number(input.value);
              out.textContent = readVal() + unit;
              syncPct();
              applySfVars(doc, vals);
              renderReadout();
              sfRemember(doc, vals);
            });
            row.appendChild(input);
            panel.appendChild(row);
            sliders.push({ key, input, out, unit, scale, min, max, step, readVal });
          };

          // —— 色盘（HSV 色环 + 亮度条），替换原 RGB 三通道滑块 ——
          const clamp01 = (n) => Math.min(1, Math.max(0, n));
          const hsvToRgb = (h, s, v) => {
            h = ((h % 360) + 360) % 360;
            const c = v * s;
            const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
            const m = v - c;
            let r = 0, g = 0, b = 0;
            if (h < 60) { r = c; g = x; }
            else if (h < 120) { r = x; g = c; }
            else if (h < 180) { g = c; b = x; }
            else if (h < 240) { g = x; b = c; }
            else if (h < 300) { r = x; b = c; }
            else { r = c; b = x; }
            return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
          };
          const rgbToHsv = (rgb) => {
            const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
            let h = 0;
            if (d !== 0) {
              if (mx === r) h = 60 * (((g - b) / d) % 6);
              else if (mx === g) h = 60 * ((b - r) / d + 2);
              else h = 60 * ((r - g) / d + 4);
            }
            return { h: (h + 360) % 360, s: mx === 0 ? 0 : d / mx, v: mx };
          };

          const WH = 140; // 色环直径（css px）
          const colorPop = doc.createElement("div");
          colorPop.className = "preview-color-pop";
          colorPop.style.display = "none";
          const wheelWrap = doc.createElement("div");
          wheelWrap.className = "preview-color-wheel";
          const cv = doc.createElement("canvas");
          cv.style.width = WH + "px";
          cv.style.height = WH + "px";
          {
            const dpr = (view.devicePixelRatio || 1);
            cv.width = WH * dpr;
            cv.height = WH * dpr;
            const cx = cv.getContext("2d");
            cx.scale(dpr, dpr);
            const R = WH / 2;
            const drawFull = () => {
              cx.clearRect(0, 0, WH, WH);
              cx.beginPath();
              cx.arc(R, R, R - 0.5, 0, Math.PI * 2);
              cx.fillStyle = "#fff";
              cx.fill();
              let conic = null;
              try { conic = cx.createConicGradient(0, R, R); } catch (err) { conic = null; }
              if (conic) {
                for (let i = 0; i <= 24; i++) {
                  conic.addColorStop(i / 24, "hsl(" + Math.round(i * 15) + " 100% 50%)");
                }
                cx.fillStyle = conic;
                cx.beginPath();
                cx.arc(R, R, R - 0.5, 0, Math.PI * 2);
                cx.fill();
              } else {
                for (let i = 0; i < 360; i += 2) {
                  cx.beginPath();
                  cx.moveTo(R, R);
                  cx.arc(R, R, R - 0.5, (i - 90) * Math.PI / 180, (i - 88) * Math.PI / 180);
                  cx.closePath();
                  cx.fillStyle = "hsl(" + i + " 100% 50%)";
                  cx.fill();
                }
              }
              const rg = cx.createRadialGradient(R, R, 0, R, R, R - 0.5);
              rg.addColorStop(0, "rgba(255,255,255,1)");
              rg.addColorStop(0.85, "rgba(255,255,255,0.55)");
              rg.addColorStop(1, "rgba(255,255,255,0)");
              cx.beginPath();
              cx.arc(R, R, R - 0.5, 0, Math.PI * 2);
              cx.fillStyle = rg;
              cx.fill();
            };
            drawFull();
          }
          const cThumb = doc.createElement("div");
          cThumb.className = "preview-color-thumb";
          wheelWrap.append(cv, cThumb);
          const vbar = doc.createElement("div");
          vbar.className = "preview-color-vbar";
          const vfill = doc.createElement("div");
          vfill.className = "preview-color-vfill";
          const vThumb = doc.createElement("div");
          vThumb.className = "preview-color-vthumb";
          vbar.append(vfill, vThumb);
          const hexEl = doc.createElement("input");
          hexEl.type = "text";
          hexEl.className = "preview-color-hex";
          hexEl.autocomplete = "off";
          hexEl.spellcheck = false;
          hexEl.placeholder = "#rrggbb";
          colorPop.append(wheelWrap, vbar, hexEl);
          doc.body.appendChild(colorPop);

          const popCtl = { key: null, rowRef: null, openSwatch: null, h: 0, s: 1, v: 1 };
          const RR = WH / 2;

          const placeWheelThumb = () => {
            const a = popCtl.h * Math.PI / 180;
            const rad = popCtl.s * (RR - 9);
            cThumb.style.left = (RR + Math.cos(a) * rad) + "px";
            cThumb.style.top = (RR + Math.sin(a) * rad) + "px";
            cThumb.style.display = "block";
          };
          // hex 输入框：仅在未聚焦时回填，避免打断正在输入
          const syncHexInput = () => {
            if (doc.activeElement !== hexEl) hexEl.value = hex(vals[popCtl.key]);
          };
          // 解析 #rgb / #rrggbb（容忍缺 #、大小写、空白）；非法返回 null
          const parseHexInput = (str) => {
            let s = String(str || "").trim().replace(/^#/, "");
            if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
            if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
            return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
          };
          const refreshPopDisplay = () => {
            const hsv = rgbToHsv(vals[popCtl.key]);
            popCtl.h = hsv.h; popCtl.s = hsv.s; popCtl.v = hsv.v;
            placeWheelThumb();
            vThumb.style.left = (popCtl.v * 100) + "%";
            vfill.style.background = "linear-gradient(to right, #000, hsl(" +
              Math.round(hsv.h) + " 100% " + Math.round(hsv.s * 100) + "%))";
            syncHexInput();
          };
          const commitPop = () => {
            if (!popCtl.key) return;
            vals[popCtl.key] = hsvToRgb(popCtl.h, popCtl.s, popCtl.v);
            applySfVars(doc, vals);
            renderReadout();
            sfRemember(doc, vals);
            const r = popCtl.rowRef;
            if (r) {
              r.out.textContent = hex(vals[popCtl.key]);
              r.paintSwatch();
            }
            syncHexInput();
          };
          const closeColorPop = () => {
            colorPop.style.display = "none";
            cThumb.style.display = "none";
            popCtl.key = null;
            popCtl.rowRef = null;
            popCtl.openSwatch = null;
          };
          panel.__sfCloseColorPop = closeColorPop;
          // hex 直接输入：合法即应用并让色环/亮度跟随；非法还原当前色值
          const applyHexInput = () => {
            if (!popCtl.key) return;
            const rgb = parseHexInput(hexEl.value);
            if (!rgb) {
              hexEl.value = hex(vals[popCtl.key]);
              return;
            }
            vals[popCtl.key] = rgb;
            const hsv = rgbToHsv(rgb);
            popCtl.h = hsv.h; popCtl.s = hsv.s; popCtl.v = hsv.v;
            placeWheelThumb();
            vThumb.style.left = (popCtl.v * 100) + "%";
            vfill.style.background = "linear-gradient(to right, #000, hsl(" +
              Math.round(hsv.h) + " 100% " + Math.round(hsv.s * 100) + "%))";
            hexEl.value = hex(rgb);
            commitPop();
          };
          hexEl.addEventListener("change", applyHexInput);
          hexEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); hexEl.blur(); applyHexInput(); }
            if (e.key === "Escape") { hexEl.value = hex(vals[popCtl.key]); hexEl.blur(); }
          });
          const openColorPop = (key, rowRef, swatchEl) => {
            if (popCtl.key === key && colorPop.style.display !== "none") {
              closeColorPop();
              return;
            }
            popCtl.key = key;
            popCtl.rowRef = rowRef;
            popCtl.openSwatch = swatchEl;
            refreshPopDisplay();
            const r = swatchEl.getBoundingClientRect();
            colorPop.style.display = "grid";
            const pw = colorPop.offsetWidth, ph = colorPop.offsetHeight;
            let left = r.right + 8, top = r.top;
            if (left + pw > view.innerWidth - 8) left = r.left - pw - 8;
            if (left < 8) left = 8;
            if (top + ph > view.innerHeight - 8) top = view.innerHeight - ph - 8;
            if (top < 8) top = 8;
            colorPop.style.left = left + "px";
            colorPop.style.top = top + "px";
          };

          const pointerPick = (e, el) => {
            const r = el.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
          };
          cv.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件无活动指针，忽略 */ }
            const pick = (ev) => {
              const p = pointerPick(ev, cv);
              const dx = p.x - RR, dy = p.y - RR;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const maxR = RR - 9;
              popCtl.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
              popCtl.s = clamp01(dist / maxR);
              placeWheelThumb();
              vfill.style.background = "linear-gradient(to right, #000, hsl(" +
                Math.round(popCtl.h) + " 100% " + Math.round(popCtl.s * 100) + "%))";
              commitPop();
            };
            pick(e);
            const onMove = (ev) => pick(ev);
            const onUp = () => {
              cv.removeEventListener("pointermove", onMove);
              cv.removeEventListener("pointerup", onUp);
              cv.removeEventListener("pointercancel", onUp);
            };
            cv.addEventListener("pointermove", onMove);
            cv.addEventListener("pointerup", onUp);
            cv.addEventListener("pointercancel", onUp);
          });
          vbar.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            const setV = (ev) => {
              const p = pointerPick(ev, vbar);
              popCtl.v = clamp01(p.x / p.w);
              vThumb.style.left = (popCtl.v * 100) + "%";
              commitPop();
            };
            setV(e);
            const onMove = (ev) => setV(ev);
            const onUp = () => {
              vbar.removeEventListener("pointermove", onMove);
              vbar.removeEventListener("pointerup", onUp);
              vbar.removeEventListener("pointercancel", onUp);
            };
            vbar.addEventListener("pointermove", onMove);
            vbar.addEventListener("pointerup", onUp);
            vbar.addEventListener("pointercancel", onUp);
          });
          // 点色盘外部关闭
          doc.addEventListener("pointerdown", (e) => {
            if (colorPop.style.display === "none") return;
            if (colorPop.contains(e.target)) return;
            if (popCtl.openSwatch && (e.target === popCtl.openSwatch || popCtl.openSwatch.contains(e.target))) return;
            closeColorPop();
          });

          const addRgb = (key, label) => {
            const row = doc.createElement("div");
            row.className = "preview-tuning-rgb";
            const lab = doc.createElement("label");
            lab.textContent = label;
            const out = doc.createElement("output");
            out.textContent = hex(vals[key]);
            const swatch = doc.createElement("button");
            swatch.type = "button";
            swatch.className = "preview-tuning-swatch";
            swatch.title = "打开色盘";
            const paintSwatch = () => { swatch.style.background = hex(vals[key]); };
            paintSwatch();
            swatch.addEventListener("click", (e) => {
              e.stopPropagation();
              openColorPop(key, { out, paintSwatch }, swatch);
            });
            row.append(lab, out, swatch);
            panel.appendChild(row);
            rgbRows.push({ key, out, swatch, paintSwatch });
          };

          // 全量同步面板控件 ↔ vals（预设应用 / 重置共用）
          const syncPanelUI = () => {
            for (const s of sliders) {
              s.input.value = String(vals[s.key]);
              const pct = ((vals[s.key] - s.min * (s.scale || 1)) / ((s.max - s.min) * (s.scale || 1))) * 100;
              s.input.style.setProperty("--pct", pct.toFixed(1) + "%");
              s.out.textContent = s.readVal() + s.unit;
            }
            for (const r of rgbRows) {
              r.out.textContent = hex(vals[r.key]);
              r.paintSwatch();
            }
            applySfVars(doc, vals);
            renderReadout();
            if (colorPop.style.display !== "none" && popCtl.key) refreshPopDisplay();
          };

          // —— 当前模式预设：只允许操作面板当前模式，历史同样按模式隔离 ——
          addSection("预设");
          const presetCurrent = doc.createElement("div");
          presetCurrent.className = "preview-tuning-preset-current";
          const presetMode = doc.createElement("span");
          presetMode.className = "preview-tuning-preset-mode";
          const presetTime = doc.createElement("span");
          presetTime.className = "preview-tuning-preset-time";
          const presetActions = doc.createElement("div");
          presetActions.className = "preview-tuning-preset-actions";
          const saveCurrentBtn = doc.createElement("button");
          saveCurrentBtn.type = "button";
          saveCurrentBtn.textContent = "保存当前";
          const exportCurrentBtn = doc.createElement("button");
          exportCurrentBtn.type = "button";
          exportCurrentBtn.textContent = "导出当前";
          const exportAllBtn = doc.createElement("button");
          exportAllBtn.type = "button";
          exportAllBtn.textContent = "导出全部";
          presetActions.append(saveCurrentBtn, exportCurrentBtn, exportAllBtn);
          presetCurrent.append(presetMode, presetTime, presetActions);
          panel.appendChild(presetCurrent);

          const historyDetails = doc.createElement("details");
          historyDetails.className = "preview-tuning-history";
          const historySummary = doc.createElement("summary");
          const historyList = doc.createElement("div");
          historyList.className = "preview-tuning-history-list";
          historyDetails.append(historySummary, historyList);
          panel.appendChild(historyDetails);
          historyDetails.addEventListener("toggle", () => {
            view.requestAnimationFrame(() => constrainPanel());
          });

          const flashPresetButton = (button, text) => {
            const original = button.dataset.sfLabel || button.textContent;
            button.dataset.sfLabel = original;
            button.textContent = text;
            view.setTimeout(() => { button.textContent = original; }, 1000);
          };
          const currentMode = () => SF_MODE_ORDER.includes(panel.__sfMode) ? panel.__sfMode : "dynamic";
          const currentValuesMatch = (record) =>
            !!record && JSON.stringify(record.values) === JSON.stringify(vals);

          let presetSlot = null;
          let presetDirty = false;
          const paintPresetSummary = () => {
            const mode = currentMode();
            presetMode.textContent = "当前 · " + SF_MODE_LABELS[mode];
            if (!presetSlot || !presetSlot.savedAt) {
              presetTime.textContent = "当前调整尚未保存";
              presetTime.title = "当前模式还没有手动保存记录";
            } else {
              const savedAt = formatSfTime(presetSlot.savedAt, true);
              presetTime.textContent = presetDirty ? "有未保存调整 · 上次 " + savedAt : "保存于 " + savedAt;
              presetTime.title = formatSfTime(presetSlot.savedAt, false);
            }
          };
          const refreshPresetSummary = () => {
            presetSlot = loadSfSlotRecord(currentMode());
            presetDirty = !currentValuesMatch(presetSlot);
            paintPresetSummary();
          };

          const renderPresetHistory = () => {
            const mode = currentMode();
            const history = loadSfHistory(mode);
            historySummary.textContent = "历史保存 · " + history.length;
            historyList.replaceChildren();
            if (history.length === 0) {
              const empty = doc.createElement("div");
              empty.className = "preview-tuning-history-empty";
              empty.textContent = "当前模式暂无历史";
              historyList.appendChild(empty);
              return;
            }
            for (const record of history) {
              const item = doc.createElement("div");
              item.className = "preview-tuning-history-item";
              const time = doc.createElement("time");
              time.dateTime = new Date(record.savedAt).toISOString();
              time.textContent = formatSfTime(record.savedAt, true);
              time.title = formatSfTime(record.savedAt, false);
              const restoreBtn = doc.createElement("button");
              restoreBtn.type = "button";
              restoreBtn.textContent = "恢复";
              restoreBtn.addEventListener("click", () => {
                const restored = restoreSfSnapshot(mode, record);
                if (!restored) return;
                Object.assign(vals, cloneSfValues(restored.values));
                syncPanelUI();
                renderPresetManager();
                flashPresetButton(restoreBtn, "已恢复");
              });
              const deleteBtn = doc.createElement("button");
              deleteBtn.type = "button";
              deleteBtn.textContent = "删除";
              deleteBtn.addEventListener("click", () => {
                deleteSfSnapshot(mode, record.id);
                renderPresetManager();
              });
              item.append(time, restoreBtn, deleteBtn);
              historyList.appendChild(item);
            }
          };

          const renderPresetManager = () => {
            refreshPresetSummary();
            renderPresetHistory();
          };
          panel.__sfMarkDirty = () => {
            if (presetDirty) return;
            presetDirty = true;
            paintPresetSummary();
          };

          saveCurrentBtn.addEventListener("click", () => {
            saveSfSnapshot(currentMode(), vals);
            renderPresetManager();
            flashPresetButton(saveCurrentBtn, "已保存");
          });
          exportCurrentBtn.addEventListener("click", () => {
            const mode = currentMode();
            saveSfDraftNow(mode, vals);
            const slot = loadSfSlotRecord(mode);
            const now = Date.now();
            const exported = downloadSfJson(doc, "sillyclient-soft-focus-" + mode + "-" + sfFileStamp(now) + ".json", {
              schema: "sillyclient-soft-focus-preset",
              version: SF_STORAGE_VERSION,
              mode,
              modeLabel: SF_MODE_LABELS[mode],
              savedAt: currentValuesMatch(slot) ? slot.savedAt : null,
              exportedAt: now,
              values: cloneSfValues(vals),
            });
            flashPresetButton(exportCurrentBtn, exported ? "已导出" : "导出失败");
          });
          exportAllBtn.addEventListener("click", () => {
            const mode = currentMode();
            saveSfDraftNow(mode, vals);
            const now = Date.now();
            const workspaces = {};
            const savedPresets = {};
            const histories = {};
            for (const key of SF_MODE_ORDER) {
              workspaces[key] = loadSfModeValues(key);
              savedPresets[key] = loadSfSlotRecord(key);
              histories[key] = loadSfHistory(key);
            }
            const exported = downloadSfJson(doc, "sillyclient-soft-focus-all-" + sfFileStamp(now) + ".json", {
              schema: "sillyclient-soft-focus-preset-bundle",
              version: SF_STORAGE_VERSION,
              exportedAt: now,
              workspaces,
              savedPresets,
              histories,
            });
            flashPresetButton(exportAllBtn, exported ? "已导出" : "导出失败");
          });
          renderPresetManager();

          addSection("材质");
          addSlider("blur", "背景模糊", 0, 40, "px");
          addSlider("sat", "磨砂饱和度", 50, 200, "%", 1);
          addSlider("radius", "圆角", 0, 40, "px");
          addSlider("fog", "雾层透明度", 0, 100, "%", 1);
          addSlider("noise", "噪点强度", 0, 100, "%", 1);
          addSection("发光");
          addSlider("glow1", "内发光1", 0, 100, "%", 1);
          addSlider("glow1Spread", "发光1扩散", 0, 60, "px");
          addSlider("glow2", "内发光2", 0, 100, "%", 1);
          addSlider("glow2Spread", "发光2扩散", 0, 90, "px");
          addSection("外阴影");
          addSlider("shY", "阴影纵向偏移", 0, 16, "px");
          addSlider("shBlur", "阴影模糊", 0, 36, "px");
          addSlider("shA", "阴影浓度", 0, 60, "%", 1, 0.5);
          addSection("内部图片");
          addSlider("imgOp", "图片透明度", 0, 100, "%", 1);
          addSlider("imgBri", "图片亮度", 20, 180, "%", 1);
          addSlider("imgSat", "图片饱和度", 0, 200, "%", 1);
          addSlider("imgBlur", "图片模糊", 0, 20, "px");
          addSection("内部遮罩");
          addSlider("cover", "遮罩浓度", 0, 100, "%", 1);
          addSection("渐变遮罩（动态/黑夜）");
          addSlider("gradBc", "收起底部浓度", 0, 100, "%", 1);
          addSlider("gradHc", "收起覆盖高度", 0, 100, "%", 1);
          addSlider("gradBe", "展开底部浓度", 0, 100, "%", 1);
          addSlider("gradHe", "展开覆盖高度", 0, 100, "%", 1);
          addSection("渐变遮罩（浅色）");
          addSlider("lgBc", "收起底部浓度", 0, 100, "%", 1);
          addSlider("lgHc", "收起覆盖高度", 0, 100, "%", 1);
          addSlider("lgBe", "展开底部浓度", 0, 100, "%", 1);
          addSlider("lgHe", "展开覆盖高度", 0, 100, "%", 1);
          addSection("倾斜");
          addSlider("tiltMax", "倾斜幅度", 0, 12, "°", 1, 0.5);
          addSection("颜色");
          addRgb("glow1Rgb", "发光1颜色");
          addRgb("glow2Rgb", "发光2颜色");
          addRgb("coverRgb", "遮罩颜色");
          addRgb("fogRgb", "雾层颜色");
          addRgb("gradRgb", "渐变颜色");
          addRgb("lgRgb", "渐变颜色（浅色）");
          addRgb("shRgb", "外阴影颜色");

          resetBtn.addEventListener("click", () => {
            const mode = currentMode();
            Object.assign(vals, sfDefaultValues(mode));
            syncPanelUI();
            saveSfDraftNow(mode, vals);
            renderPresetManager();
          });

          // 主题联动固定切换独立工作区。离开前同步落盘，进入时总是加载
          // 目标 draft（首次为目标槽或独立默认值），不存在“保留上一模式”。
          panel.__sfSwitchMode = (mode) => {
            if (!SF_MODE_ORDER.includes(mode)) return false;
            const previous = currentMode();
            if (previous === mode) return true;
            saveSfDraftNow(previous, vals);
            Object.assign(vals, loadSfModeValues(mode));
            panel.__sfMode = mode;
            syncPanelUI();
            renderPresetManager();
            return true;
          };

          renderReadout();
          panel.appendChild(valueOut);
          doc.body.appendChild(panel);
          sfThemeTick(doc);
        };

        // 用 iframe 自身 realm 的 MutationObserver 监听 React 重渲染。
        // 关键：回调本身就是微任务、必然在本帧绘制之前执行，
        // 所以直接同步重打标记——绝不能推迟到 rAF（那是绘制之后，必闪一帧旧 UI）。
        let observedDoc = null;
        // 强引用：注册表对 observer 只持弱引用，局部变量被 GC 后 observer 会静默停摆。
        let activeObserver = null;
        let observedThemeRoot = null;
        let activeThemeObserver = null;
        let themeIntentDoc = null;

        // 白天/黑夜互切通常只改变根节点 class，不产生 childList 事件。
        // 单独监听这一处属性，避免给整棵树开启 attributes 造成新的高频负担。
        const installThemeRootObserver = (currentDoc, root) => {
          const view = currentDoc && currentDoc.defaultView;
          const nextRoot = root || currentDoc?.querySelector("#root > div");
          if (!view || !nextRoot || typeof view.MutationObserver !== "function") return;
          if (observedThemeRoot === nextRoot) return;
          if (activeThemeObserver) activeThemeObserver.disconnect();
          observedThemeRoot = nextRoot;
          activeThemeObserver = new view.MutationObserver(() => {
            const liveRoot = currentDoc.querySelector("#root > div");
            if (!liveRoot) return;
            if (liveRoot !== observedThemeRoot) installThemeRootObserver(currentDoc, liveRoot);
            if (liveRoot.classList.contains("theme-smoothing")) {
              liveRoot.classList.remove("theme-smoothing");
            }
            syncLightMode(currentDoc, liveRoot);
            ensureTuningPanel(currentDoc);
          });
          activeThemeObserver.observe(nextRoot, { attributes: true, attributeFilter: ["class"] });
        };

        // 在 React 的 click 处理器之前仅记录明确目标并暂停昂贵过渡；
        // 工作区等真实 DOM 确认模式后再同步，避免旧背景混入新预设一帧。
        const installThemeIntentCapture = (currentDoc) => {
          if (!currentDoc || themeIntentDoc === currentDoc) return;
          themeIntentDoc = currentDoc;
          currentDoc.addEventListener("click", (event) => {
            const target = event.target && event.target.nodeType === 1 ? event.target : null;
            const button = target && target.closest("button");
            const menu = button && button.closest(".ios-floating-menu");
            if (!button || !menu || !menu.textContent.includes("背景设置")) return;
            const label = button.textContent.replace(/\s+/g, "");
            let mode = null;
            if (label === "基础") mode = "dynamic";
            else if (label === "自定义") {
              clearSfPendingTheme();
              const view = currentDoc.defaultView;
              if (view) {
                currentDoc.documentElement.classList.add("preview-theme-switching");
                if (sfThemeSwitchTimer) view.clearTimeout(sfThemeSwitchTimer);
                sfThemeSwitchTimer = view.setTimeout(() => {
                  sfThemeSwitchTimer = 0;
                  currentDoc.documentElement.classList.remove("preview-theme-switching");
                }, 240);
              }
              return;
            }
            else if (label === "暗夜") mode = "dark";
            else if (label === "白天") mode = "light";
            if (mode) beginSfThemeSwitch(currentDoc, mode);
          }, true);
        };

        // 壁纸移除检测：节点可能作为整棵子树被摘除，需深入查找；
        // 若移除后 #root 里仍有壁纸节点（含刚挂载还未打标注的），说明是 React 换图/重挂载，跳过以免飘幽灵。
        const handleWallpaperRemovals = (mutations, currentDoc) => {
          if (currentDoc.querySelector('#root [data-preview-wallpaper], #root div.fixed.inset-0.z-0[style*="background-image"]')) return;
          for (const m of mutations) {
            for (const node of m.removedNodes) {
              if (node.nodeType !== 1 || node.id === "preview-wallpaper-fade-out") continue;
              const target = node.matches("[data-preview-wallpaper]")
                ? node
                : node.querySelector("[data-preview-wallpaper]");
              if (target) {
                fadeOutWallpaper(currentDoc, target);
                return;
              }
            }
          }
        };

        const installMutationObserver = () => {
          const d = frame.contentDocument;
          const view = frame.contentWindow;
          if (!d || !view || !d.body || typeof view.MutationObserver !== "function") return;
          if (observedDoc === d) return;
          if (activeObserver) activeObserver.disconnect();
          observedDoc = d;
          const mo = new view.MutationObserver((mutations) => {
            const currentDoc = frame.contentDocument;
            if (!currentDoc) return;
            handleWallpaperRemovals(mutations, currentDoc);
            annotatePreview(currentDoc);
          });
          mo.observe(d.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
          });
          activeObserver = mo;
        };

        const injectPreview = () => {
          const doc = frame.contentDocument;
          if (!doc || !doc.head || !doc.body) return;

          if (!doc.getElementById("control-island-wallpaper-review")) {
            const style = doc.createElement("style");
            style.id = "control-island-wallpaper-review";
            style.textContent = materialCss;
            doc.head.appendChild(style);
          }

          doc.documentElement.style.setProperty("--preview-wallpaper-blur", `${wallpaperBlur}px`);
          installMutationObserver();

          if (previewStarted) return;
          previewStarted = true;

          annotatePreview(doc);
          // observer 已覆盖主题属性与 DOM 变化；低频轮询只处理极端重挂载兜底。
          if (previewPollTimer) window.clearInterval(previewPollTimer);
          previewPollTimer = window.setInterval(() => {
            const currentDoc = frame.contentDocument;
            if (currentDoc) {
              installMutationObserver();
              annotatePreview(currentDoc);
            }
          }, 4000);
        };

        frame.addEventListener("load", () => {
          previewGeneration += 1;
          previewStarted = false;
          sfHeavyDoc = null;
          sfHeavyRaf = 0;
          edgeBlurRaf = 0;
          edgeBlurScrollDoc = null;
          sfThemeSwitchTimer = 0;
          clearSfPendingTheme();
          injectPreview();
          setTimeout(injectPreview, 300);
          setTimeout(injectPreview, 1200);
        });
        if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
          injectPreview();
        }
      })();
