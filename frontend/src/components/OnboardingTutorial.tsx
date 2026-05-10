import { useEffect, useState } from "react";
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, HelpCircle, MessageSquare, PlayCircle, Settings, Sliders, Sprout, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STORAGE_KEY = "croptwin_onboarding_completed_v2";

type TutorialStep = {
  title: string;
  subtitle: string;
  body: string;
  icon: LucideIcon;
  tip: string;
  bullets: string[];
};

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to CropTwin AI",
    subtitle: "Quick start for first-time users",
    body: "CropTwin AI is a vertical-farm digital twin. It helps you monitor farm health, simulate problems, receive alerts, take safe actions, and explain results clearly during a demo.",
    icon: HelpCircle,
    tip: "Best demo route: Dashboard → Simulator → Alerts → Control Panel → Operations → Yield Forecast.",
    bullets: [
      "Use the left menu to move between farm modules.",
      "Use the green live badge to confirm the backend stream is connected.",
      "Click the help icon anytime to reopen this guide.",
    ],
  },
  {
    title: "1. Start from Dashboard",
    subtitle: "Understand farm status first",
    body: "The Dashboard gives the fastest overview of what is happening inside the farm before you run any demo scenario.",
    icon: PlayCircle,
    tip: "Before presenting, point out total farm health, layer status, alerts, and live stream connection.",
    bullets: [
      "Check the Farm Health score at the top.",
      "Look for warning or critical layers before taking action.",
      "Use Dashboard as your opening page for judges or users.",
    ],
  },
  {
    title: "2. Run a demo incident",
    subtitle: "Simulate a real farm problem",
    body: "Open Simulator & Detector, then choose a scenario such as high humidity, low moisture, or pH drift. The system will update layer readings and trigger detection logic.",
    icon: Sliders,
    tip: "This proves the system can react to realistic farm conditions without needing physical hardware on stage.",
    bullets: [
      "Choose one incident at a time so the story is easy to follow.",
      "After running a scenario, return to Dashboard or Alerts.",
      "Use this as the moment where the farm moves from normal to risky.",
    ],
  },
  {
    title: "3. Read Alerts carefully",
    subtitle: "Explain what went wrong and why",
    body: "The Alerts page shows detected risks, severity, affected layer, and recommended actions. This is where users understand the problem before controlling devices.",
    icon: Bell,
    tip: "A strong explanation is: condition detected → risk to crop → recommended safe response.",
    bullets: [
      "Check severity first: warning, critical, or resolved.",
      "Read the explanation instead of only looking at the score.",
      "Use alerts to justify why the next action is needed.",
    ],
  },
  {
    title: "4. Take a safe action",
    subtitle: "Use Control Panel for intervention",
    body: "Open Control Panel to activate devices or safe AI commands. The goal is to show a closed-loop workflow: detect a problem, decide an action, then improve the farm condition.",
    icon: Settings,
    tip: "For a demo, say: CropTwin does not only show data; it recommends and supports controlled action.",
    bullets: [
      "Use manual controls when you want a predictable demo flow.",
      "Use AI control decisions when you want to show automation.",
      "Avoid changing too many devices at once during presentation.",
    ],
  },
  {
    title: "5. Prove impact with records",
    subtitle: "Show the result, not just the action",
    body: "Open Operations Timeline and Yield Forecast to show what happened after action was taken. This helps prove that the system creates business and operational value.",
    icon: ClipboardList,
    tip: "Judges care about impact: healthier crops, better yield, lower risk, and clearer decision history.",
    bullets: [
      "Operations Timeline shows the sequence of events.",
      "Yield Forecast estimates harvest weight and revenue.",
      "Market Intel can support location or expansion decisions.",
    ],
  },
  {
    title: "6. Ask the assistant",
    subtitle: "Use Chat-to-Farm for human-friendly summaries",
    body: "The chat button at the bottom-right can explain farm status, risks, and next actions in plain language. Use it when you want a fast summary instead of reading every panel.",
    icon: MessageSquare,
    tip: "Good questions: ‘What happened today?’, ‘Which layer needs attention?’, or ‘What should I do next?’",
    bullets: [
      "Ask one clear question at a time.",
      "Use it to summarize alerts for non-technical users.",
      "If AI keys are missing, core farm monitoring still works.",
    ],
  },
  {
    title: "7. Crop recipes and yield",
    subtitle: "Connect operations to crop outcomes",
    body: "Crop Recipe shows ideal growing conditions, while Yield Forecast estimates harvest readiness, expected kilograms, and revenue. Together, they connect sensor data to farm planning.",
    icon: Sprout,
    tip: "On mobile, swipe tables left and right when columns are wider than the screen.",
    bullets: [
      "Use Crop Recipe to explain ideal temperature, humidity, pH, and light.",
      "Use Yield Forecast to show expected production value.",
      "Use mobile swipe for wide tables during phone demos.",
    ],
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-3 pb-3 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-0">
      <section className="max-h-[92dvh] w-full max-w-2xl overflow-hidden rounded-2xl border border-card-border bg-white shadow-2xl">
        <div className="h-1.5 bg-field-bg">
          <div className="h-full bg-forest-green transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="max-h-[calc(92dvh-92px)] overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-spring-green/25 text-forest-green">
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Quick start · {step + 1}/{STEPS.length}</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{current.title}</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-forest-green/80">{current.subtitle}</p>
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

          <div className="mt-5 rounded-xl border border-card-border bg-field-bg p-4">
            <div className="flex gap-2 text-sm text-ink/80">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest-green" />
              <span>{current.tip}</span>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-spring-green/20 bg-spring-green/5 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-forest-green">What to do</p>
            <ul className="space-y-2 text-sm leading-relaxed text-ink/80">
              {current.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-forest-green" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border bg-white p-4 sm:p-6">
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
