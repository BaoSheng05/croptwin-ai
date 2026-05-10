import { useEffect, useState } from "react";
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, HelpCircle, MessageSquare, PlayCircle, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STORAGE_KEY = "croptwin_onboarding_completed_v1";

type TutorialStep = {
  title: string;
  body: string;
  icon: LucideIcon;
  tip: string;
};

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to CropTwin AI",
    body: "This app helps you monitor a vertical farm, trigger demo incidents, and prove that AI actions improve farm outcomes.",
    icon: HelpCircle,
    tip: "For a hackathon demo, start from Dashboard.",
  },
  {
    title: "Step 1: Run a scenario",
    body: "On Dashboard, choose a controlled incident like High Humidity or Low Moisture, then press Run Scenario.",
    icon: PlayCircle,
    tip: "This simulates what would happen in a real farm without needing physical hardware.",
  },
  {
    title: "Step 2: Read the alert",
    body: "Open Alerts to see what CropTwin detected, why it matters, and what action is recommended.",
    icon: Bell,
    tip: "Use this page to explain the AI diagnosis to judges.",
  },
  {
    title: "Step 3: Prove the impact",
    body: "Open Operations to show the timeline, before/after health, and expected yield or revenue impact.",
    icon: ClipboardList,
    tip: "This proves the system is decision + action + audit trail, not just a dashboard.",
  },
  {
    title: "Need help anytime?",
    body: "Use the chat button at the bottom-right corner to ask questions about farm status, next action, or overall summary.",
    icon: MessageSquare,
    tip: "You can skip this tutorial now and still reopen it from the Help button.",
  },
];

type OnboardingTutorialProps = {
  forceOpen?: boolean;
  onClose?: () => void;
};

export function OnboardingTutorial({ forceOpen = false, onClose }: OnboardingTutorialProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }
    const completed = window.localStorage.getItem(STORAGE_KEY);
    if (!completed) setOpen(true);
  }, [forceOpen]);

  function close(markComplete: boolean) {
    if (markComplete) window.localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
    onClose?.();
  }

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const progress = ((step + 1) / STEPS.length) * 100;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <section className="w-full max-w-xl overflow-hidden rounded-2xl border border-card-border bg-white shadow-2xl">
        <div className="h-1.5 bg-field-bg">
          <div className="h-full bg-forest-green transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex items-start justify-between gap-4 p-6">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-spring-green/25 text-forest-green">
              <Icon size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Quick start · {step + 1}/{STEPS.length}</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">{current.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{current.body}</p>
            </div>
          </div>
          <button
            onClick={() => close(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-card-border bg-field-bg text-muted transition hover:text-ink"
            aria-label="Skip tutorial"
            title="Skip tutorial"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mx-6 rounded-lg border border-card-border bg-field-bg p-4">
          <div className="flex gap-2 text-sm text-ink/80">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest-green" />
            <span>{current.tip}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-6">
          <button
            onClick={() => close(true)}
            className="rounded-md border border-card-border bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink"
          >
            Skip tutorial
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-md border border-card-border bg-field-bg px-4 py-2 text-sm font-semibold text-ink transition disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={() => isLast ? close(true) : setStep((value) => Math.min(STEPS.length - 1, value + 1))}
              className="inline-flex items-center gap-2 rounded-md bg-forest-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-green/90"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
