import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

import {
  type InitOptions,
  type AIProvider,
  type Framework,
  type BackendFramework,
  type DeploymentMode,
  GITHUB_APP_URL,
  PROVIDER_CONFIGS,
  FRAMEWORK_CONFIGS,
  BACKEND_CONFIGS,
} from './types';
import { githubDeviceFlow, fetchUserRepos } from './auth';
import {
  detectFramework,
  detectBackendFramework,
  isFullstackFramework,
  findWidgetFilePath,
  findApiRoutePath,
  generateWidgetFileContent,
  getHostedWidgetExample,
} from './frameworks';
import { generateReusableWorkflow, generateEjectedWorkflow } from './workflow';

export async function runInitCommand(options: InitOptions): Promise<void> {
  p.intro(chalk.bgMagenta.white(' inner-lens Setup Wizard '));

  const cwd = process.cwd();

  let detectedRepo = '';
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const pkg = await fs.readJson(packageJsonPath);
      if (pkg.repository?.url) {
        const match = pkg.repository.url.match(/github\.com[/:](.+?\/.+?)(?:\.git)?$/);
        if (match) detectedRepo = match[1];
      }
    }
  } catch {
    // ignore
  }

  let repository: string;
  let owner: string = '';
  let repo: string = '';
  let provider: AIProvider;
  let model: string;
  let language: string;
  let framework: Framework;
  let backendFramework: BackendFramework | null = null;
  let githubToken: string | null = null;
  let generateFiles = true;
  let backendDeploy: string = 'cloudflare';
  let deploymentMode: DeploymentMode = 'hosted';

  if (options.yes) {
    provider = options.provider && options.provider in PROVIDER_CONFIGS
      ? options.provider as AIProvider
      : 'anthropic';
    model = PROVIDER_CONFIGS[provider].defaultModel;
    language = 'en';
    repository = detectedRepo || 'owner/repo';
    const [parsedOwner, parsedRepo] = repository.split('/');
    owner = parsedOwner || '';
    repo = parsedRepo || '';
    const detected = await detectFramework(cwd);
    framework = detected || 'nextjs-app';
    deploymentMode = 'hosted';
  } else {
    p.log.step(chalk.bold('Step 1/5: Deployment Mode'));

    const selectedMode = await p.select({
      message: 'How do you want to deploy bug reports?',
      options: [
        {
          value: 'hosted',
          label: 'Hosted Mode (Recommended)',
          hint: 'No backend setup — uses inner-lens-app[bot]',
        },
        {
          value: 'self-hosted',
          label: 'Self-Hosted',
          hint: 'Run your own backend with GitHub token',
        },
      ],
      initialValue: 'hosted',
    });

    if (p.isCancel(selectedMode)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    deploymentMode = selectedMode as DeploymentMode;

    if (deploymentMode === 'hosted') {
      p.log.step(chalk.bold('Step 2/5: Repository'));

      p.note(
        `Install the GitHub App on your repository:\n${chalk.cyan(GITHUB_APP_URL)}`,
        'GitHub App Required'
      );

      try {
        const openCommand = process.platform === 'darwin' ? 'open' :
                           process.platform === 'win32' ? 'start' : 'xdg-open';
        execSync(`${openCommand} ${GITHUB_APP_URL}`, { stdio: 'ignore' });
        p.log.info('Browser opened automatically.');
      } catch {
        p.log.info('Please open your browser manually.');
      }

      const inputRepo = await p.text({
        message: 'GitHub repository (owner/repo):',
        placeholder: detectedRepo || 'owner/repo',
        initialValue: detectedRepo,
        validate: (value) => {
          if (!value || !value.includes('/')) {
            return 'Please enter in owner/repo format';
          }
        },
      });

      if (p.isCancel(inputRepo)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }

      repository = inputRepo;
      const [parsedOwner2, parsedRepo2] = repository.split('/');
      owner = parsedOwner2 || '';
      repo = parsedRepo2 || '';

    } else {
      p.log.step(chalk.bold('Step 2/5: GitHub Integration'));

      const authMethod = await p.select({
        message: 'GitHub authentication method:',
        options: [
          { value: 'oauth', label: 'GitHub Login (OAuth)', hint: 'recommended' },
          { value: 'manual', label: 'Enter token manually (PAT)' },
          { value: 'skip', label: 'Set up later' },
        ],
        initialValue: 'oauth',
      });

      if (p.isCancel(authMethod)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }

      if (authMethod === 'oauth') {
        githubToken = await githubDeviceFlow();

        if (githubToken) {
          const repoSpinner = p.spinner();
          repoSpinner.start('Fetching repository list...');
          const repos = await fetchUserRepos(githubToken);
          repoSpinner.stop('Repository list loaded');

          if (repos.length > 0) {
            const repoChoices = detectedRepo && !repos.includes(detectedRepo)
              ? [detectedRepo, ...repos]
              : repos;

            const selectedRepo = await p.select({
              message: 'Select repository:',
              options: [
                ...repoChoices.map(r => ({ value: r, label: r })),
                { value: '__custom__', label: 'Enter manually...' },
              ],
              initialValue: detectedRepo || repos[0],
            });

            if (p.isCancel(selectedRepo)) {
              p.cancel('Setup cancelled.');
              process.exit(0);
            }

            if (selectedRepo === '__custom__') {
              const customRepo = await p.text({
                message: 'GitHub repository (owner/repo):',
                validate: (value) => {
                  if (!value || !value.includes('/')) {
                    return 'Please enter in owner/repo format';
                  }
                },
              });

              if (p.isCancel(customRepo)) {
                p.cancel('Setup cancelled.');
                process.exit(0);
              }

              repository = customRepo;
            } else {
              repository = selectedRepo;
            }
          } else {
            const inputRepo = await p.text({
              message: 'GitHub repository (owner/repo):',
              placeholder: detectedRepo || 'owner/repo',
              initialValue: detectedRepo,
              validate: (value) => {
                if (!value || !value.includes('/')) {
                  return 'Please enter in owner/repo format';
                }
              },
            });

            if (p.isCancel(inputRepo)) {
              p.cancel('Setup cancelled.');
              process.exit(0);
            }

            repository = inputRepo;
          }
        } else {
          p.log.warn('OAuth authentication failed. Proceeding with manual setup.');

          const inputRepo = await p.text({
            message: 'GitHub repository (owner/repo):',
            placeholder: detectedRepo || 'owner/repo',
            initialValue: detectedRepo,
            validate: (value) => {
              if (!value || !value.includes('/')) {
                return 'Please enter in owner/repo format';
              }
            },
          });

          if (p.isCancel(inputRepo)) {
            p.cancel('Setup cancelled.');
            process.exit(0);
          }

          repository = inputRepo;
        }
      } else if (authMethod === 'manual') {
        const inputRepo = await p.text({
          message: 'GitHub repository (owner/repo):',
          placeholder: detectedRepo || 'owner/repo',
          initialValue: detectedRepo,
          validate: (value) => {
            if (!value || !value.includes('/')) {
              return 'Please enter in owner/repo format';
            }
          },
        });

        if (p.isCancel(inputRepo)) {
          p.cancel('Setup cancelled.');
          process.exit(0);
        }

        repository = inputRepo;

        p.note(
          'Enter your GitHub Personal Access Token.\n' +
          `Create one: ${chalk.cyan('https://github.com/settings/tokens/new?scopes=repo')}`,
          'GitHub Token'
        );

        const inputToken = await p.password({
          message: 'GitHub Token:',
          validate: (value) => {
            if (!value || value.length < 10) {
              return 'Please enter a valid token';
            }
          },
        });

        if (p.isCancel(inputToken)) {
          p.cancel('Setup cancelled.');
          process.exit(0);
        }

        githubToken = inputToken;
      } else {
        const inputRepo = await p.text({
          message: 'GitHub repository (owner/repo):',
          placeholder: detectedRepo || 'owner/repo',
          initialValue: detectedRepo,
          validate: (value) => {
            if (!value || !value.includes('/')) {
              return 'Please enter in owner/repo format';
            }
          },
        });

        if (p.isCancel(inputRepo)) {
          p.cancel('Setup cancelled.');
          process.exit(0);
        }

        repository = inputRepo;
        const [parsedOwner3, parsedRepo3] = repository.split('/');
        owner = parsedOwner3 || '';
        repo = parsedRepo3 || '';
      }
    }

    const stepFramework = deploymentMode === 'hosted' ? '3/5' : '3/5';
    p.log.step(chalk.bold(`Step ${stepFramework}: Framework`));

    const detectedFramework = await detectFramework(cwd);

    if (detectedFramework) {
      p.log.info(`Detected framework: ${FRAMEWORK_CONFIGS[detectedFramework].name}`);

      const useDetected = await p.confirm({
        message: `Is ${FRAMEWORK_CONFIGS[detectedFramework].name} correct?`,
        initialValue: true,
      });

      if (p.isCancel(useDetected)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }

      if (useDetected) {
        framework = detectedFramework;
      } else {
        const selectedFramework = await p.select({
          message: 'Select framework:',
          options: Object.entries(FRAMEWORK_CONFIGS).map(([key, config]) => ({
            value: key,
            label: config.name,
          })),
        });

        if (p.isCancel(selectedFramework)) {
          p.cancel('Setup cancelled.');
          process.exit(0);
        }

        framework = selectedFramework as Framework;
      }
    } else {
      const selectedFramework = await p.select({
        message: 'Select framework:',
        options: Object.entries(FRAMEWORK_CONFIGS).map(([key, config]) => ({
          value: key,
          label: config.name,
        })),
      });

      if (p.isCancel(selectedFramework)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }

      framework = selectedFramework as Framework;
    }

    const stepAI = deploymentMode === 'hosted' ? '4/5' : '4/5';
    p.log.step(chalk.bold(`Step ${stepAI}: AI Provider & Model`));

    const selectedProvider = await p.select({
      message: 'Select AI Provider:',
      options: [
        { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'recommended' },
        { value: 'openai', label: 'OpenAI (GPT)' },
        { value: 'google', label: 'Google (Gemini)' },
      ],
      initialValue: 'anthropic',
    });

    if (p.isCancel(selectedProvider)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    provider = selectedProvider as AIProvider;
    const providerConfig = PROVIDER_CONFIGS[provider];

    const modelOptions = [
      ...providerConfig.modelSuggestions.map((m, i) => ({
        value: m,
        label: m,
        hint: i === 0 ? 'default' : undefined,
      })),
      { value: '__custom__', label: 'Enter custom model name...', hint: 'for new/preview models' },
    ];

    const selectedModel = await p.select({
      message: `Select ${providerConfig.name} model:`,
      options: modelOptions,
      initialValue: providerConfig.defaultModel,
    });

    if (p.isCancel(selectedModel)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    if (selectedModel === '__custom__') {
      const customModel = await p.text({
        message: 'Enter model name:',
        placeholder: providerConfig.defaultModel,
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Model name is required';
          }
          if (value.trim().length < 3) {
            return 'Model name is too short';
          }
          if (!/^[a-zA-Z0-9._-]+$/.test(value.trim())) {
            return 'Model name can only contain letters, numbers, dots, hyphens, and underscores';
          }
          return undefined;
        },
      });

      if (p.isCancel(customModel)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }

      model = (customModel as string).trim();
      p.log.info(`Using custom model: ${chalk.cyan(model)}`);
    } else {
      model = selectedModel as string;
    }

    const selectedLanguage = await p.select({
      message: 'Analysis output language:',
      options: [
        { value: 'en', label: 'English' },
        { value: 'ko', label: '한국어 (Korean)' },
        { value: 'ja', label: '日本語 (Japanese)' },
        { value: 'zh', label: '中文 (Chinese)' },
        { value: 'es', label: 'Español (Spanish)' },
        { value: 'de', label: 'Deutsch (German)' },
        { value: 'fr', label: 'Français (French)' },
        { value: 'pt', label: 'Português (Portuguese)' },
      ],
      initialValue: 'en',
    });

    if (p.isCancel(selectedLanguage)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    language = selectedLanguage as string;

    if (deploymentMode === 'self-hosted') {
      if (isFullstackFramework(framework)) {
        backendFramework = await detectBackendFramework(cwd, framework);
      } else {
        p.log.step(chalk.bold('Step 5/5: Backend Deployment'));

        const selectedBackend = await p.select({
          message: 'Backend deployment method:',
          options: [
            { value: 'cloudflare', label: 'Cloudflare Workers', hint: 'standalone, free 100k/day' },
            { value: 'vercel', label: 'Vercel', hint: 'deploy with frontend' },
            { value: 'netlify', label: 'Netlify', hint: 'deploy with frontend' },
            { value: 'existing', label: 'Use existing backend server', hint: 'Express, Fastify, etc.' },
            { value: 'skip', label: 'Set up later' },
          ],
          initialValue: 'cloudflare',
        });

        if (p.isCancel(selectedBackend)) {
          p.cancel('Setup cancelled.');
          process.exit(0);
        }

        backendDeploy = selectedBackend;
      }
    }

    const generateMessage = isFullstackFramework(framework)
      ? 'Auto-generate widget and API route files?'
      : 'Auto-generate widget files?';

    const shouldGenerate = await p.confirm({
      message: generateMessage,
      initialValue: true,
    });

    if (p.isCancel(shouldGenerate)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    generateFiles = shouldGenerate;
  }

  const providerConfig = PROVIDER_CONFIGS[provider];
  const frameworkConfig = FRAMEWORK_CONFIGS[framework];

  const generateSpinner = p.spinner();
  generateSpinner.start('Generating files...');

  const workflowsDir = path.join(cwd, '.github', 'workflows');
  await fs.ensureDir(workflowsDir);

  const workflowPath = path.join(workflowsDir, 'inner-lens.yml');

  let workflowContent: string;
  if (options.eject) {
    workflowContent = generateEjectedWorkflow(provider, model, language, providerConfig);
  } else {
    workflowContent = generateReusableWorkflow(provider, model, language, providerConfig);
  }

  await fs.writeFile(workflowPath, workflowContent);

  if (githubToken) {
    const envLocalPath = path.join(cwd, '.env.local');
    let envContent = '';

    if (await fs.pathExists(envLocalPath)) {
      envContent = await fs.readFile(envLocalPath, 'utf-8');
    }

    if (envContent.includes('GITHUB_TOKEN=')) {
      envContent = envContent.replace(/GITHUB_TOKEN=.*/g, `GITHUB_TOKEN=${githubToken}`);
    } else {
      envContent = envContent.trim() + (envContent ? '\n' : '') + `GITHUB_TOKEN=${githubToken}\n`;
    }

    await fs.writeFile(envLocalPath, envContent);

    const gitignorePath = path.join(cwd, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.env.local')) {
        await fs.appendFile(gitignorePath, '\n.env.local\n');
      }
    }
  }

  let widgetFileCreated = false;
  let apiRouteFileCreated = false;
  let widgetFilePath = '';
  let apiRouteFilePath = '';

  if (generateFiles) {
    if (framework !== 'vanilla') {
      widgetFilePath = await findWidgetFilePath(cwd, framework);
      const fullWidgetPath = path.join(cwd, widgetFilePath);

      let existingContent: string | null = null;
      if (await fs.pathExists(fullWidgetPath)) {
        existingContent = await fs.readFile(fullWidgetPath, 'utf-8');
      }

      const newContent = generateWidgetFileContent(
        framework,
        existingContent,
        deploymentMode,
        deploymentMode === 'hosted' ? { owner, repo } : undefined
      );

      if (newContent !== existingContent) {
        await fs.ensureDir(path.dirname(fullWidgetPath));
        await fs.writeFile(fullWidgetPath, newContent);
        widgetFileCreated = true;
      }
    }

    if (deploymentMode === 'self-hosted' && backendFramework) {
      apiRouteFilePath = await findApiRoutePath(cwd, backendFramework);
      const fullApiRoutePath = path.join(cwd, apiRouteFilePath);

      if (!(await fs.pathExists(fullApiRoutePath))) {
        const backendConfig = BACKEND_CONFIGS[backendFramework];
        let apiRouteContent = backendConfig.apiRouteTemplate;

        apiRouteContent = apiRouteContent.replace(
          "process.env.GITHUB_REPOSITORY || 'owner/repo'",
          `process.env.GITHUB_REPOSITORY || '${repository}'`
        );

        await fs.ensureDir(path.dirname(fullApiRoutePath));
        await fs.writeFile(fullApiRoutePath, apiRouteContent);
        apiRouteFileCreated = true;
      }
    }

    if (deploymentMode === 'self-hosted') {
      const envLocalPath = path.join(cwd, '.env.local');
      let envContent = '';
      if (await fs.pathExists(envLocalPath)) {
        envContent = await fs.readFile(envLocalPath, 'utf-8');
      }

      if (!envContent.includes('GITHUB_REPOSITORY=')) {
        envContent = envContent.trim() + (envContent ? '\n' : '') + `GITHUB_REPOSITORY=${repository}\n`;
        await fs.writeFile(envLocalPath, envContent);
      }
    }
  }

  generateSpinner.stop('Files generated');

  const generatedFiles: string[] = ['.github/workflows/inner-lens.yml'];
  if (githubToken) generatedFiles.push('.env.local (GITHUB_TOKEN)');
  if (widgetFileCreated) generatedFiles.push(widgetFilePath);
  if (apiRouteFileCreated) generatedFiles.push(apiRouteFilePath);

  p.note(generatedFiles.map(f => `  ${chalk.green('+')} ${f}`).join('\n'), 'Generated Files');

  const nextSteps: string[] = [];
  let stepNumber = 1;

  if (deploymentMode === 'hosted') {
    nextSteps.push(
      `${chalk.bold(`${stepNumber}. Install GitHub App (if not done)`)}\n` +
      `   ${chalk.cyan(GITHUB_APP_URL)}\n` +
      `   Select your repository: ${chalk.yellow(repository)}`
    );
    stepNumber++;

    nextSteps.push(
      `${chalk.bold(`${stepNumber}. Configure GitHub Secret for AI`)}\n` +
      `   GitHub repository → Settings → Secrets → Actions\n` +
      `   ${chalk.yellow(providerConfig.secretName)}\n` +
      `   ${chalk.dim(`Link: https://github.com/${repository}/settings/secrets/actions`)}`
    );
    stepNumber++;

    if (!widgetFileCreated) {
      const hostedExample = getHostedWidgetExample(framework, owner, repo);
      nextSteps.push(
        `${chalk.bold(`${stepNumber}. Add widget (${frameworkConfig.name})`)}\n` +
        `   ${chalk.gray(`// ${frameworkConfig.widgetFile}`)}\n` +
        hostedExample.split('\n').map(l => `   ${chalk.cyan(l)}`).join('\n')
      );
      stepNumber++;
    }

    nextSteps.push(
      `${chalk.bold(`${stepNumber}. Test`)}\n` +
      `   npm run dev → Click the bug report button!`
    );

  } else {
    nextSteps.push(
      `${chalk.bold(`${stepNumber}. Configure GitHub Secrets`)}\n` +
      `   GitHub repository → Settings → Secrets → Actions\n` +
      (githubToken ? '' : `   ${chalk.yellow('GITHUB_TOKEN')} (requires repo scope)\n`) +
      `   ${chalk.yellow(providerConfig.secretName)}\n` +
      `   ${chalk.dim(`Link: https://github.com/${repository}/settings/secrets/actions`)}`
    );
    stepNumber++;

    if (!githubToken) {
      nextSteps.push(
        `${chalk.bold(`${stepNumber}. Set environment variables (.env.local)`)}\n` +
        `   ${chalk.gray('# .env.local')}\n` +
        `   ${chalk.green('GITHUB_TOKEN=')}${chalk.gray('ghp_xxxxxxxxxxxx')}`
      );
      stepNumber++;
    }

    if (!widgetFileCreated) {
      nextSteps.push(
        `${chalk.bold(`${stepNumber}. Add widget (${frameworkConfig.name})`)}\n` +
        `   ${chalk.gray(`// ${frameworkConfig.widgetFile}`)}\n` +
        frameworkConfig.example.split('\n').map(l => `   ${chalk.cyan(l)}`).join('\n')
      );
      stepNumber++;
    }

    if (isFullstackFramework(framework) && !apiRouteFileCreated && backendFramework) {
      const backendConfig = BACKEND_CONFIGS[backendFramework];
      nextSteps.push(
        `${chalk.bold(`${stepNumber}. Add API route (${backendConfig.name})`)}\n` +
        `   ${chalk.gray(`// ${backendConfig.apiRouteFile}`)}\n` +
        backendConfig.apiRouteTemplate.split('\n').map(l => `   ${chalk.cyan(l)}`).join('\n')
      );
      stepNumber++;
    }

    if (!isFullstackFramework(framework)) {
      let backendInstructions = '';

      switch (backendDeploy) {
        case 'cloudflare':
          backendInstructions =
            `${chalk.bold.yellow('Cloudflare Workers')} (free 100k requests/day)\n\n` +
            `   See: ${chalk.cyan('https://github.com/jhlee0409/inner-lens#cloudflare-workers')}`;
          break;
        case 'vercel':
          backendInstructions =
            `${chalk.bold.cyan('Vercel Serverless Function')}\n\n` +
            `   See: ${chalk.cyan('https://github.com/jhlee0409/inner-lens#self-hosted-backend-advanced')}`;
          break;
        case 'netlify':
          backendInstructions =
            `${chalk.bold.cyan('Netlify Function')}\n\n` +
            `   See: ${chalk.cyan('https://github.com/jhlee0409/inner-lens#self-hosted-backend-advanced')}`;
          break;
        case 'existing':
          backendInstructions =
            `${chalk.bold.dim('Use existing backend server')}\n\n` +
            `   ${chalk.gray('// Express example:')}\n` +
            `   ${chalk.cyan(`import { createExpressHandler } from 'inner-lens/server';`)}\n` +
            `   ${chalk.cyan(`app.post('/api/inner-lens/report', createExpressHandler({`)}\n` +
            `   ${chalk.cyan(`  githubToken: process.env.GITHUB_TOKEN,`)}\n` +
            `   ${chalk.cyan(`  repository: '${repository}',`)}\n` +
            `   ${chalk.cyan(`}));`)}`;
          break;
        default:
          backendInstructions =
            `See: ${chalk.cyan('https://github.com/jhlee0409/inner-lens#self-hosted-backend-advanced')}`;
      }

      nextSteps.push(
        `${chalk.bold(`${stepNumber}. Backend setup`)}\n` +
        `   ${backendInstructions}`
      );
      stepNumber++;
    }

    nextSteps.push(
      `${chalk.bold(`${stepNumber}. Test`)}\n` +
      `   npm run dev → Click the bug report button!`
    );
  }

  p.note(nextSteps.join('\n\n'), 'Next Steps');

  if (deploymentMode === 'hosted') {
    if (widgetFileCreated) {
      p.log.success('Hosted mode configured! Widget file generated.');
      p.log.info('Make sure the GitHub App is installed on your repository.');
    }
  } else if (githubToken) {
    p.log.success('GitHub integration complete! Token saved automatically.');
  }

  if (deploymentMode === 'self-hosted' && isFullstackFramework(framework) && widgetFileCreated && apiRouteFileCreated) {
    p.log.success('Widget and API route configured automatically!');
    p.log.info('Run npm run dev to test immediately.');
  } else if (deploymentMode === 'self-hosted' && !isFullstackFramework(framework) && widgetFileCreated) {
    p.log.success('Widget configured automatically!');
    p.log.info('Configure your backend server before testing.');
  }

  p.outro(
    `Documentation: ${chalk.cyan('https://github.com/jhlee0409/inner-lens')}`
  );
}

export async function runCheckCommand(): Promise<void> {
  p.intro(chalk.bgMagenta.white(' inner-lens Configuration Check '));

  const cwd = process.cwd();
  const results: { label: string; status: 'success' | 'warn' | 'error'; message?: string }[] = [];

  const workflowPath = path.join(cwd, '.github', 'workflows', 'inner-lens.yml');
  if (await fs.pathExists(workflowPath)) {
    results.push({ label: 'GitHub workflow', status: 'success' });
  } else {
    results.push({
      label: 'GitHub workflow',
      status: 'error',
      message: 'Run: npx inner-lens init',
    });
  }

  const detectedFramework = await detectFramework(cwd);
  if (detectedFramework) {
    results.push({
      label: 'Framework',
      status: 'success',
      message: FRAMEWORK_CONFIGS[detectedFramework].name,
    });
  } else {
    results.push({ label: 'Framework', status: 'warn', message: 'Could not detect' });
  }

  const packageJsonPath = path.join(cwd, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps['inner-lens']) {
      results.push({ label: 'inner-lens package', status: 'success' });
    } else {
      results.push({
        label: 'inner-lens package',
        status: 'warn',
        message: 'Run: npm install inner-lens',
      });
    }
  }

  const envLocalPath = path.join(cwd, '.env.local');
  if (await fs.pathExists(envLocalPath)) {
    const envContent = await fs.readFile(envLocalPath, 'utf-8');
    if (envContent.includes('GITHUB_TOKEN')) {
      results.push({ label: 'GITHUB_TOKEN', status: 'success' });
    } else {
      results.push({
        label: 'GITHUB_TOKEN',
        status: 'warn',
        message: 'Add to .env.local',
      });
    }
  } else {
    results.push({
      label: '.env.local',
      status: 'warn',
      message: 'Create with GITHUB_TOKEN',
    });
  }

  for (const result of results) {
    if (result.status === 'success') {
      p.log.success(`${result.label}${result.message ? `: ${result.message}` : ''}`);
    } else if (result.status === 'warn') {
      p.log.warn(`${result.label}${result.message ? ` - ${result.message}` : ''}`);
    } else {
      p.log.error(`${result.label}${result.message ? ` - ${result.message}` : ''}`);
    }
  }

  const hasErrors = results.some(r => r.status === 'error');
  const hasWarnings = results.some(r => r.status === 'warn');

  if (hasErrors) {
    p.outro(chalk.red('Configuration issues found.'));
  } else if (hasWarnings) {
    p.outro(chalk.yellow('Some warnings. Check the items above.'));
  } else {
    p.outro(chalk.green('All checks passed!'));
  }
}
