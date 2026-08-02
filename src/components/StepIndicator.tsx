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
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      padding: "16px 0",
    }}>
      {STEPS.map((step, i) => (
        <div key={step.number} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "20px",
            fontSize: "0.75rem",
            fontWeight: 700,
            background: step.number === currentStep
              ? "var(--green)"
              : step.number < currentStep
                ? "#e4f5e9"
                : "var(--paper)",
            color: step.number === currentStep
              ? "white"
              : step.number < currentStep
                ? "var(--green)"
                : "var(--muted)",
            border: `1px solid ${step.number <= currentStep ? "var(--green)" : "var(--line)"}`,
          }}>
            {step.number < currentStep ? "✓" : step.number}
            <span>{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              width: "20px",
              height: "1px",
              background: step.number < currentStep ? "var(--green)" : "var(--line)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}
