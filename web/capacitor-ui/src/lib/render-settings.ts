/** 酒馆顶栏取色与渲染引擎设置 */
export interface RenderEngineSettings {
  immersiveColor: boolean;
  colorExtractionMode: "realtime" | "once";
  clickEffect: boolean;
}

export function normalizeRenderEngineSettings(
  input?: Partial<RenderEngineSettings> | null,
): RenderEngineSettings {
  const immersiveColor = input?.immersiveColor !== false;
  const colorExtractionMode =
    input?.colorExtractionMode === "once" ? "once" : "realtime";
  return {
    immersiveColor,
    colorExtractionMode,
    clickEffect: immersiveColor && input?.clickEffect !== false,
  };
}
