import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './spinner.js';
import { Progress } from './progress.js';

export interface EnhanceState {
  stage: 'idle' | 'reading' | 'fetching' | 'linting' | 'enhancing' | 'saving' | 'done' | 'error';
  message: string;
  progress: number;
  file?: string;
  output?: string;
  error?: string;
}

interface EnhanceUIProps {
  state: EnhanceState;
  onConfirm?: () => void;
}

export const EnhanceUI: React.FC<EnhanceUIProps> = ({ state }) => {
  const renderStage = () => {
    switch (state.stage) {
      case 'idle':
        return <Spinner text={state.message || 'Ready...'} />;
      case 'reading':
        return <Spinner text={state.message || 'Reading file...'} />;
      case 'fetching':
        return <Spinner text={state.message || 'Fetching from GitHub...'} />;
      case 'linting':
        return <Spinner text={state.message || 'Running awesome-lint...'} />;
      case 'enhancing':
        return (
          <Box flexDirection="column">
            <Spinner text={state.message || 'Enhancing awesome list...'} />
            {state.progress > 0 && <Text color="gray"> Processing: {state.progress}%</Text>}
          </Box>
        );
      case 'saving':
        return <Spinner text={state.message || 'Saving changes...'} />;
      case 'done':
        return (
          <Box flexDirection="column">
            <Text color="green">✓ {state.message || 'Enhancement complete!'}</Text>
            {state.output && (
              <Text color="cyan">
                📄 Output written to: <Text bold>{state.output}</Text>
              </Text>
            )}
          </Box>
        );
      case 'error':
        return <Text color="red">✕ {state.error || state.message}</Text>;
      default:
        return null;
    }
  };

  const renderSteps = () => {
    const steps = [
      { label: 'Reading file', stage: 'reading' as const },
      { label: 'Fetching from URL', stage: 'fetching' as const },
      { label: 'Running lint', stage: 'linting' as const },
      { label: 'Enhancing content', stage: 'enhancing' as const },
      { label: 'Saving results', stage: 'saving' as const },
    ];

    return (
      <Box flexDirection="column" marginTop={1}>
        {steps.map((step) => (
          <Progress
            key={step.stage}
            label={step.label}
            completed={steps.indexOf(step) < steps.findIndex((s) => s.stage === state.stage)}
            percent={step.stage === state.stage ? state.progress : undefined}
          />
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        🚀 awesome-enhancer
      </Text>
      <Text color="gray">{'─'.repeat(40)}</Text>
      {renderStage()}
      {state.stage !== 'idle' && state.stage !== 'done' && state.stage !== 'error' && renderSteps()}
      {state.file && state.stage !== 'done' && state.stage !== 'error' && (
        <Text color="gray">Input: {state.file}</Text>
      )}
    </Box>
  );
};
