import React from 'react';
import { Box, Text } from 'ink';

interface BeforeAfterProps {
  before: string;
  after: string;
  title?: string;
}

export const BeforeAfter: React.FC<BeforeAfterProps> = ({ before, after, title }) => {
  const beforeLines = before.split('\n').slice(0, 8);
  const afterLines = after.split('\n').slice(0, 8);
  const _maxLines = Math.max(beforeLines.length, afterLines.length);

  return (
    <Box flexDirection="column" marginY={1}>
      {title && (
        <Text bold color="cyan">
          {title}
        </Text>
      )}
      <Box>
        <Box width="50%" paddingRight={2}>
          <Text bold color="yellow">
            BEFORE
          </Text>
          <Text color="gray">{'─'.repeat(30)}</Text>
          {beforeLines.map((line, i) => (
            <Text key={i} color="gray" wrap="truncate">
              {line || ' '}
            </Text>
          ))}
        </Box>
        <Box width="50%" paddingLeft={2}>
          <Text bold color="green">
            AFTER
          </Text>
          <Text color="gray">{'─'.repeat(30)}</Text>
          {afterLines.map((line, i) => (
            <Text key={i} color="green" wrap="truncate">
              {line || ' '}
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

interface StatsDisplayProps {
  enhancements: {
    linksProcessed: number;
    metadataAdded: number;
    descriptionsImproved: number;
    staleDetected: number;
  };
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({ enhancements }) => {
  const statItems = [
    { label: 'Links processed', value: enhancements.linksProcessed, color: 'cyan' },
    { label: 'Metadata added', value: enhancements.metadataAdded, color: 'green' },
    { label: 'Descriptions improved', value: enhancements.descriptionsImproved, color: 'blue' },
    { label: 'Stale repos detected', value: enhancements.staleDetected, color: 'yellow' },
  ];

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="cyan">
        📊 Enhancement Summary
      </Text>
      <Text color="gray">{'─'.repeat(40)}</Text>
      {statItems.map((stat) => (
        <Box key={stat.label} justifyContent="space-between" paddingX={1}>
          <Text color="gray">{stat.label}:</Text>
          <Text bold color={stat.color as any}>
            {stat.value}
          </Text>
        </Box>
      ))}
    </Box>
  );
};

export const getAsciiBanner = (): string => {
  return `
╔═══════════════════════════════════════════╗
║     🚀 awesome-enhancer v0.4.0           ║
║     Enhance awesome lists with AI        ║
╚═══════════════════════════════════════════╝`;
};
