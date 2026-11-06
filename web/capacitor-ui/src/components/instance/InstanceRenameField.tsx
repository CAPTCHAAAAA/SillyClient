import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import "./InstanceRenameField.css";

export interface InstanceRenameState {
  instanceId: string;
  value: string;
  error: string | null;
  saving: boolean;
  closing: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClosed: () => void;
}

interface InstanceRenameFieldProps {
  state: InstanceRenameState;
  isLight: boolean;
}

export function InstanceRenameField({ state, isLight }: InstanceRenameFieldProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [phase, setPhase] = useState<"entering" | "opening" | "open">("entering");

  useEffect(() => {
    if (state.closing) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setPhase(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "open" : "opening");
        inputRef.current?.focus({ preventScroll: true });
        inputRef.current?.select();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [state.closing]);

  useEffect(() => {
    if (!state.closing || !formRef.current) return;
    let active = true;
    const transitions = formRef.current.getAnimations();
    void Promise.all(transitions.map(transition => transition.finished.catch(() => {}))).then(() => {
      if (active) state.onClosed();
    });
    return () => { active = false; };
  }, [state.closing, state.onClosed]);

  return (
    <form
      ref={formRef}
      className={cn("instance-rename-field", isLight && "is-light")}
      data-state={state.closing ? "closing" : phase}
      aria-label="重命名实例"
      aria-busy={state.saving}
      aria-hidden={state.closing || undefined}
      inert={state.closing}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === "opacity" && !state.closing) {
          setPhase("open");
        }
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        if (!state.saving && state.value.trim()) state.onSave();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        aria-label="实例新名称"
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? errorId : undefined}
        value={state.value}
        disabled={state.saving}
        onChange={(event) => state.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
            event.preventDefault();
          }
        }}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="输入新名称"
        className="instance-rename-field__input ios-field-control motion-control"
      />
      <button
        type="button"
        aria-label="取消重命名"
        title="取消"
        disabled={state.saving}
        onClick={state.onCancel}
        className="instance-rename-field__action flat-capsule motion-control"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <button
        type="submit"
        aria-label="保存名称"
        title="保存"
        disabled={state.saving || !state.value.trim()}
        className="instance-rename-field__action flat-capsule motion-control"
      >
        {state.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      {state.error && (
        <div id={errorId} role="alert" className="instance-rename-field__error">
          {state.error}
        </div>
      )}
    </form>
  );
}
