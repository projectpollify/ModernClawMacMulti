import { useMemo } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';
import { EngineStep } from '@/components/onboarding/EngineStep';
import { ModelStep } from '@/components/onboarding/ModelStep';
import { MemoryStep } from '@/components/onboarding/MemoryStep';
import { CompleteStep } from '@/components/onboarding/CompleteStep';
import { cn } from '@/lib/utils';

const STEPS = ['welcome', 'engine', 'model', 'memory', 'complete'] as const;
type StepName = (typeof STEPS)[number];

export function OnboardingFlow() {
  const currentStep = useOnboardingStore((state) => state.currentStep);
  const setStep = useOnboardingStore((state) => state.setStep);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const step = useMemo<StepName>(() => STEPS[currentStep] ?? 'welcome', [currentStep]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setStep(currentStep + 1);
      return;
    }

    completeOnboarding();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setStep(currentStep - 1);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_42%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(241,245,249,0.92))] px-6 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.95))]">
      <div className="w-full max-w-3xl rounded-[36px] border border-border bg-background/92 p-8 shadow-[0_28px_120px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((name, index) => (
            <div
              key={name}
              className={cn(
                'h-2 rounded-full transition-all',
                index === currentStep ? 'w-10 bg-primary' : index < currentStep ? 'w-6 bg-primary/70' : 'w-6 bg-muted'
              )}
            />
          ))}
        </div>

        {step === 'welcome' ? <WelcomeStep onNext={handleNext} /> : null}
        {step === 'engine' ? <EngineStep onNext={handleNext} onBack={handleBack} /> : null}
        {step === 'model' ? <ModelStep onNext={handleNext} onBack={handleBack} /> : null}
        {step === 'memory' ? <MemoryStep onNext={handleNext} onBack={handleBack} /> : null}
        {step === 'complete' ? <CompleteStep onFinish={completeOnboarding} /> : null}
      </div>
    </div>
  );
}
