import React from 'react';
import { Text } from 'ink';

interface ProgressProps {
  label: string;
  percent?: number;
  completed?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({ label, percent, completed }) => {
  const barWidth = 20;
  const filled = Math.round(((percent ?? 0) / 100) * barWidth);
  const empty = barWidth - filled;

  const bar = completed ? '█'.repeat(barWidth) : '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <Text>
      {completed ? (
        <Text color="green">✓</Text>
      ) : percent !== undefined ? (
        <Text color="cyan">◐</Text>
      ) : (
        <Text color="yellow">◌</Text>
      )}{' '}
      {label}
      {percent !== undefined && (
        <Text color="gray">
          {' '}
          [{bar}] {percent}%
        </Text>
      )}
      {completed && <Text color="green"> Done!</Text>}
    </Text>
  );
};
