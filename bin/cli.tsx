#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { enhanceCommand } from '../src/commands/enhance.js';
import { EnhanceUI } from '../src/ui/enhance-ui.js';
import { EnhanceState } from '../src/ui/enhance-ui.js';
import { GitService } from '../src/services/git.js';
import { getAsciiBanner } from '../src/ui/before-after.js';

interface CliOptions {
  addMetadata?: boolean;
  updateDescriptions?: boolean;
  detectStale?: boolean;
  detectRedirects?: boolean;
  output?: string;
  dryRun?: boolean;
  githubToken?: string;
  skipLint?: boolean;
}

function parseArgs(): { fileOrUrl?: string; options: CliOptions } {
  const args = process.argv.slice(2);
  const options: CliOptions = {};
  let fileOrUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--add-metadata') {
      options.addMetadata = true;
    } else if (arg === '--update-descriptions') {
      options.updateDescriptions = true;
    } else if (arg === '--detect-stale') {
      options.detectStale = true;
    } else if (arg === '--detect-redirects') {
      options.detectRedirects = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-lint') {
      options.skipLint = true;
    } else if (arg === '--output' && i + 1 < args.length) {
      options.output = args[++i];
    } else if (arg === '--github-token' && i + 1 < args.length) {
      options.githubToken = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      console.log('awesome-enhancer v0.1.0');
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      fileOrUrl = arg;
    }
  }

  return { fileOrUrl, options };
}

function printHelp() {
  console.log(`
${getAsciiBanner()}

CLI tool to enhance awesome lists with metadata and descriptions

Usage: awesome-enhancer [file-or-url] [options]

Arguments:
  file-or-url              Path to local markdown file or GitHub repository URL

Options:
  --add-metadata           Add GitHub repository metadata (stars, forks, language)
  --update-descriptions    Improve descriptions via web scraping
  --detect-stale           Detect archived, disabled, and deleted GitHub repositories
  --detect-redirects       Detect repository redirects and transfers
  --output <file>          Output file (default: overwrites input)
  --dry-run                Preview changes without writing to file
  --github-token <token>   GitHub API token for higher rate limits
  --skip-lint              Skip running awesome-lint
  --help, -h               Show this help message
  --version, -v            Show version number

Examples:
  npx awesome-enhancer README.md --add-metadata
  npx awesome-enhancer https://github.com/user/awesome-list --update-descriptions
  npx awesome-enhancer README.md --add-metadata --update-descriptions --dry-run
  npx awesome-enhancer README.md --detect-stale
`);
}

const WELCOME_ITEMS = [
  { label: '📖  Enhance a local file', value: 'local' },
  { label: '🌐  Enhance from GitHub URL', value: 'url' },
  { label: '🔍  Enhance local README (auto-detect)', value: 'auto' },
  { label: '❌  Exit', value: 'exit' },
];

const OPTIONS_ITEMS = [
  { label: '⭐  Add metadata (stars, forks, language)', value: 'metadata' },
  { label: '✏️  Improve descriptions via web scraping', value: 'descriptions' },
  { label: '⭐✏️  Both options', value: 'both' },
  { label: '⬅️  Back', value: 'back' },
];

const MODE_ITEMS = [
  { label: '💾  Write to file', value: 'write' },
  { label: '👀  Preview (dry-run)', value: 'dry-run' },
  { label: '⬅️  Back', value: 'back' },
];

const InputPrompt: React.FC<{
  type: 'local' | 'url';
  onSubmit: (value: string) => void;
  onCancel: () => void;
}> = ({ type, onSubmit, onCancel }) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const handleKeyPress = (
      _: any,
      key: { return?: boolean; escape?: boolean; delete?: boolean },
    ) => {
      if (key.return && inputValue.trim()) {
        onSubmit(inputValue.trim());
      } else if (key.escape) {
        onCancel();
      } else if (key.delete) {
        setInputValue((v) => v.slice(0, -1));
      }
    };

    process.stdin.on('keypress', handleKeyPress);
    process.stdin.setRawMode(true);
    return () => {
      process.stdin.off('keypress', handleKeyPress);
      process.stdin.setRawMode(false);
    };
  }, [inputValue, onSubmit, onCancel]);

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {getAsciiBanner()}
      </Text>
      <Text color="gray">{'─'.repeat(40)}</Text>
      <Text color="gray">{'─'.repeat(40)}</Text>
      <Text>
        {type === 'url' ? '🌐  GitHub URL: ' : '📄  File path: '}
        <Text color="cyan" bold>
          {inputValue}
        </Text>
        <Text color="gray">_</Text>
      </Text>
      <Text color="gray">Press Enter to continue, Esc to go back</Text>
    </Box>
  );
};

const WelcomeScreen: React.FC<{ onSelect: (value: string) => void }> = ({ onSelect }) => (
  <Box flexDirection="column">
    <Text bold color="cyan">
      {getAsciiBanner()}
    </Text>
    <Text color="gray">{'─'.repeat(40)}</Text>
    <Text color="yellow">Try: npx awesome-enhancer README.md --add-metadata</Text>
    <Text color="gray">{'─'.repeat(40)}</Text>
    <Text>What would you like to enhance?</Text>
    <SelectInput items={WELCOME_ITEMS} onSelect={(item) => onSelect(item.value as string)} />
    <Text color="gray">Press ↑↓ to select, Enter to confirm</Text>
  </Box>
);

const OptionsScreen: React.FC<{
  isAuto: boolean;
  onSelect: (value: string) => void;
}> = ({ isAuto, onSelect }) => {
  const items = isAuto ? OPTIONS_ITEMS.filter((i) => i.value !== 'back') : OPTIONS_ITEMS;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {getAsciiBanner()}
      </Text>
      <Text color="gray">{'─'.repeat(40)}</Text>
      <SelectInput items={items} onSelect={(item) => onSelect(item.value as string)} />
      <Text color="gray">Press ↑↓ to select, Enter to confirm</Text>
    </Box>
  );
};

const ModeScreen: React.FC<{ onSelect: (value: string) => void }> = ({ onSelect }) => (
  <Box flexDirection="column">
    <Text bold color="cyan">
      {getAsciiBanner()}
    </Text>
    <Text color="gray">{'─'.repeat(40)}</Text>
    <SelectInput items={MODE_ITEMS} onSelect={(item) => onSelect(item.value as string)} />
    <Text color="gray">Press ↑↓ to select, Enter to confirm</Text>
  </Box>
);

const App: React.FC = () => {
  const [screen, setScreen] = useState<
    'welcome' | 'options' | 'mode' | 'running' | 'input-local' | 'input-url'
  >('welcome');
  const [inputType, setInputType] = useState<'local' | 'url'>('local');
  const [fileOrUrl, setFileOrUrl] = useState<string | undefined>();
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const [selectedMode, setSelectedMode] = useState<string | undefined>();
  const [state, setState] = useState<EnhanceState>({
    stage: 'idle',
    message: 'Starting...',
    progress: 0,
  });

  const handleWelcomeSelect = (value: string) => {
    if (value === 'exit') {
      process.exit(0);
    } else if (value === 'auto') {
      if (GitService.isGitRepo()) {
        const localReadme = GitService.findLocalReadme();
        if (localReadme) {
          setFileOrUrl(localReadme);
          setScreen('options');
        } else {
          setInputType('local');
          setScreen('input-local');
        }
      } else {
        setInputType('local');
        setScreen('input-local');
      }
    } else if (value === 'local') {
      setInputType('local');
      setScreen('input-local');
    } else if (value === 'url') {
      setInputType('url');
      setScreen('input-url');
    }
  };

  const handleOptionsSelect = (value: string) => {
    if (value === 'back') {
      setScreen('welcome');
    } else {
      setSelectedOption(value);
      setScreen('mode');
    }
  };

  const handleModeSelect = (value: string) => {
    if (value === 'back') {
      setScreen('options');
    } else {
      setSelectedMode(value);
      runEnhance();
    }
  };

  const handleInputSubmit = (value: string) => {
    setFileOrUrl(value);
    setScreen('options');
  };

  const runEnhance = async () => {
    if (!fileOrUrl || !selectedOption || !selectedMode) return;

    const options: CliOptions = {
      addMetadata: selectedOption === 'metadata' || selectedOption === 'both',
      updateDescriptions: selectedOption === 'descriptions' || selectedOption === 'both',
      dryRun: selectedMode === 'dry-run',
      skipLint: false,
    };

    setScreen('running');
    setState({
      stage: 'reading',
      message: `Reading ${fileOrUrl}...`,
      progress: 10,
      file: fileOrUrl,
    });

    setState((s) => ({
      ...s,
      stage: 'linting',
      message: 'Running awesome-lint...',
      progress: 30,
    }));

    setState((s) => ({
      ...s,
      stage: 'enhancing',
      message: 'Enhancing awesome list...',
      progress: 60,
    }));

    try {
      await enhanceCommand(fileOrUrl, options);

      const outputFile = options.output || 'enhanced-readme.md';

      setState((s) => ({
        ...s,
        stage: 'done',
        message: 'Enhancement complete!',
        progress: 100,
        output: outputFile,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        stage: 'error',
        error: error.message,
      }));
    }
  };

  if (screen === 'input-local' || screen === 'input-url') {
    return (
      <InputPrompt
        type={inputType}
        onSubmit={handleInputSubmit}
        onCancel={() => setScreen('welcome')}
      />
    );
  }

  if (screen === 'running') {
    return <EnhanceUI state={state} />;
  }

  if (screen === 'welcome') {
    return <WelcomeScreen onSelect={handleWelcomeSelect} />;
  }

  if (screen === 'options') {
    return (
      <OptionsScreen
        isAuto={fileOrUrl !== undefined && !fileOrUrl.startsWith('http')}
        onSelect={handleOptionsSelect}
      />
    );
  }

  if (screen === 'mode') {
    return <ModeScreen onSelect={handleModeSelect} />;
  }

  return null;
};

const { fileOrUrl: argFile, options: argOptions } = parseArgs();

if (argFile || argOptions.addMetadata || argOptions.updateDescriptions || argOptions.detectStale) {
  (async () => {
    const options: CliOptions = argOptions;
    if (!options.addMetadata && !options.updateDescriptions && !options.detectStale) {
      printHelp();
      process.exit(1);
    }
    await enhanceCommand(argFile!, options);
  })();
} else {
  render(<App />);
}
