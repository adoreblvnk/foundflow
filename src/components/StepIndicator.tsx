"use client";

const STEPS = [
  { number: 1, label: "Register" },
  { number: 2, label: "Photograph" },
  { number: 3, label: "Scan" },
  { number: 4, label: "Review" },
  { number: 5, label: "Finalise" },
];

interface StepIndicatorProps {
  currentStep: number;
  caseId?: string;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav className="step-indicator" aria-label="Case progress">
      <ol>
        {STEPS.map((step) => {
          const state = step.number === currentStep ? "current" : step.number < currentStep ? "complete" : "upcoming";
          return (
            <li key={step.number} className={state} aria-current={state === "current" ? "step" : undefined}>
              <span aria-hidden="true">{state === "complete" ? "✓" : step.number}</span>
              <small>{step.label}</small>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
