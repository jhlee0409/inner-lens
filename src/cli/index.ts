import { Command } from 'commander';
import chalk from 'chalk';
import { type InitOptions } from './types';
import { runInitCommand, runCheckCommand } from './setup';

declare const __INNER_LENS_VERSION__: string;
const PACKAGE_VERSION = typeof __INNER_LENS_VERSION__ !== 'undefined' 
  ? __INNER_LENS_VERSION__ 
  : '0.0.0-dev';

const program = new Command();

program
  .name('inner-lens')
  .description(
    chalk.bold('inner-lens') +
      ' - Self-Debugging QA Agent\n' +
      chalk.dim('   Zero-config bug reporting with AI-powered analysis')
  )
  .version(PACKAGE_VERSION);

program
  .command('init')
  .description('Initialize inner-lens in your project')
  .option('-e, --eject', 'Copy the full workflow source instead of using reusable workflow')
  .option('-p, --provider <provider>', 'AI provider (anthropic, openai, google)')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (options: InitOptions) => {
    await runInitCommand(options);
  });

program
  .command('check')
  .description('Verify inner-lens configuration')
  .action(async () => {
    await runCheckCommand();
  });

program.parse();
