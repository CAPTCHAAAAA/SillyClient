import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import type { PreinstalledExtensionId } from "../../capacitor-plugin";
import catalog from "../../data/preinstall-catalog.json";
import { handleExternalLink } from "../../lib/external-links";

interface PreinstallOptionsProps {
  isLight: boolean;
  themeEnabled: boolean;
  setThemeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  extensionIds: PreinstalledExtensionId[];
  setExtensionIds: React.Dispatch<React.SetStateAction<PreinstalledExtensionId[]>>;
}

export function PreinstallOptions({
  isLight, themeEnabled, setThemeEnabled, extensionIds = [], setExtensionIds,
}: PreinstallOptionsProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className={cn(
          "motion-control flex w-full items-center justify-between py-1 text-xs font-medium",
          isLight ? "text-[#1a1625]/70" : "text-white/70",
        )}
      >
        <span>预设安装</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 flex-shrink-0 opacity-40 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded && "rotate-180",
        )} />
      </button>
      <div className={cn("motion-accordion", expanded && "is-open")} aria-hidden={!expanded} inert={!expanded}>
        <div className="motion-accordion-inner">
          <div className="pt-2 space-y-3">
            <section
              className={cn("companion-preset", isLight && "is-light")}
              data-enabled={themeEnabled}
            >
              <div className="companion-preset__label">主题预设</div>
              <div className="companion-preset__row">
                <div className="companion-preset__thumb" aria-hidden="true">
                  <img
                    src="./assets/companion-presets/sc-bordeaux/sillyclient-bg-preview.jpg"
                    alt=""
                    width="112"
                    height="70"
                    decoding="async"
                  />
                </div>
                <div className="companion-preset__copy">
                  <span className="companion-preset__name">SC Bordeaux</span>
                  <span className="companion-preset__summary">
                    实例安装完成后自动应用
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="使用 SC Bordeaux 主题预设"
                  aria-checked={themeEnabled}
                  onClick={() => setThemeEnabled(value => !value)}
                  className="companion-preset__switch motion-control"
                >
                  <span className="companion-preset__knob" />
                </button>
              </div>
              <div className="companion-preset__details" aria-hidden={!themeEnabled} inert={!themeEnabled}>
                <div className="companion-preset__details-inner">
                  <div className="companion-preset__details-body">
                    <div className="companion-preset__detail-row">
                      <span>主题</span>
                      <strong>SC Bordeaux</strong>
                    </div>
                    <div className="companion-preset__detail-row">
                      <span>壁纸</span>
                      <strong>7680 × 4320 · JPG</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section className={cn("companion-preset", isLight && "is-light")}>
              <div className="companion-preset__label">扩展</div>
              <div className="space-y-2">
                {catalog.extensions.map(extension => {
                  const id = extension.id as PreinstalledExtensionId;
                  const enabled = extensionIds.includes(id);
                  const projectUrl = `https://github.com/${extension.repository}`;
                  return (
                    <div key={id} className="companion-preset__row">
                      <div className="companion-preset__copy col-span-2">
                        <span className="companion-preset__name">{extension.displayName}</span>
                        <a
                          className="companion-preset__summary min-w-0 max-w-full truncate underline underline-offset-2"
                          href={projectUrl}
                          title={projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={event => handleExternalLink(event, projectUrl)}
                          onAuxClick={event => handleExternalLink(event, projectUrl)}
                        >
                          {projectUrl}
                        </a>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-label={`预安装 ${extension.displayName}`}
                        aria-checked={enabled}
                        onClick={() => setExtensionIds(previous => previous.includes(id)
                          ? previous.filter(value => value !== id)
                          : [...previous, id])}
                        className="companion-preset__switch motion-control"
                      >
                        <span className="companion-preset__knob" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
