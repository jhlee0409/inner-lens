import * as p from '@clack/prompts';
import { execSync } from 'child_process';
import {
  GITHUB_CLIENT_ID,
  type DeviceCodeResponse,
  type AccessTokenResponse,
} from './types';

export async function githubDeviceFlow(): Promise<string | null> {
  const spinner = p.spinner();
  spinner.start('Starting GitHub OAuth authentication...');

  try {
    const deviceCodeRes = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: 'repo',
      }),
    });

    if (!deviceCodeRes.ok) {
      spinner.stop('Failed to request device code');
      throw new Error(`Failed to get device code: ${deviceCodeRes.status}`);
    }

    const deviceCode = await deviceCodeRes.json() as DeviceCodeResponse;
    spinner.stop('Device code generated');

    p.note(
      `Code: ${deviceCode.user_code}\n\n` +
      `Enter this code at the URL below:\n` +
      deviceCode.verification_uri,
      'GitHub Authentication'
    );

    try {
      const openCommand = process.platform === 'darwin' ? 'open' :
                         process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${openCommand} ${deviceCode.verification_uri}`, { stdio: 'ignore' });
      p.log.info('Browser opened automatically.');
    } catch {
      p.log.info('Please open your browser manually.');
    }

    const pollSpinner = p.spinner();
    pollSpinner.start('Waiting for authentication... (Ctrl+C to cancel)');

    const interval = (deviceCode.interval || 5) * 1000;
    const expiresAt = Date.now() + deviceCode.expires_in * 1000;

    while (Date.now() < expiresAt) {
      await new Promise(resolve => setTimeout(resolve, interval));

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const tokenData = await tokenRes.json() as AccessTokenResponse;

      if (tokenData.access_token) {
        pollSpinner.stop('GitHub authentication successful!');
        return tokenData.access_token;
      }

      if (tokenData.error === 'authorization_pending') {
        continue;
      }

      if (tokenData.error === 'slow_down') {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      if (tokenData.error === 'expired_token') {
        pollSpinner.stop('Authentication expired.');
        return null;
      }

      if (tokenData.error === 'access_denied') {
        pollSpinner.stop('Authentication denied.');
        return null;
      }

      pollSpinner.stop(`Error: ${tokenData.error_description || tokenData.error}`);
      return null;
    }

    pollSpinner.stop('Authentication expired.');
    return null;
  } catch (error) {
    p.log.error(`OAuth error: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

export async function fetchUserRepos(token: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=10', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!res.ok) return [];

    const repos = await res.json() as Array<{ full_name: string }>;
    return repos.map(r => r.full_name);
  } catch {
    return [];
  }
}
