import { DeployLocalProjectConfig } from '@twilio-labs/serverless-api';
import path from 'path';
import { Arguments } from 'yargs';
import { cliInfo } from '../commands/deploy';
import {
  ExternalCliOptions,
  SharedFlagsWithCredentials,
} from '../commands/shared';
import { deprecateFunctionsEnv } from '../commands/utils';
import { getFunctionServiceSid } from '../serverless-api/utils';
import { readSpecializedConfig } from './global';
import {
  filterEnvVariablesForDeploy,
  getCredentialsFromFlags,
  getServiceNameFromFlags,
  readLocalEnvFile,
  readPackageJsonContent,
} from './utils';
import { mergeFlagsAndConfig } from './utils/mergeFlagsAndConfig';

export type DeployCliFlags = Arguments<
  SharedFlagsWithCredentials & {
    serviceSid?: string;
    functionsEnv?: string;
    environment: string;
    production: boolean;
    projectName?: string;
    serviceName?: string;
    overrideExistingProject: boolean;
    force: boolean;
    functions: boolean;
    assets: boolean;
    assetsFolder?: string;
    functionsFolder?: string;
  }
>;

export async function getConfigFromFlags(
  flags: DeployCliFlags,
  externalCliOptions?: ExternalCliOptions
): Promise<DeployLocalProjectConfig> {
  let cwd = flags.cwd ? path.resolve(flags.cwd) : process.cwd();
  flags.cwd = cwd;

  if (typeof flags.functionsEnv !== 'undefined') {
    deprecateFunctionsEnv();
    if (!flags.environment) {
      flags.environment = flags.functionsEnv;
    }
    delete flags.functionsEnv;
  }

  const configFlags = readSpecializedConfig(cwd, flags.config, 'deployConfig', {
    projectId:
      flags.accountSid ||
      (externalCliOptions && externalCliOptions.accountSid) ||
      undefined,
    environmentSuffix: flags.environment,
  });

  flags = mergeFlagsAndConfig(configFlags, flags, cliInfo);
  cwd = flags.cwd || cwd;

  if (flags.production) {
    flags.environment = '';
  }

  const { localEnv: envFileVars, envPath } = await readLocalEnvFile(flags);
  const { accountSid, authToken } = await getCredentialsFromFlags(
    flags,
    envFileVars,
    externalCliOptions
  );

  const env = filterEnvVariablesForDeploy(envFileVars);

  const serviceSid =
    flags.serviceSid ||
    (await getFunctionServiceSid(
      cwd,
      flags.config,
      'deployConfig',
      flags.accountSid && flags.accountSid.startsWith('AC')
        ? flags.accountSid
        : externalCliOptions && externalCliOptions.accountSid
    ));

  const pkgJson = await readPackageJsonContent(flags);

  let serviceName: string | undefined = await getServiceNameFromFlags(flags);

  if (!serviceName) {
    throw new Error(
      'Please pass --service-name or add a "name" field to your package.json'
    );
  }

  const region = flags.region;
  const edge = flags.edge;

  return {
    cwd,
    envPath,
    accountSid,
    authToken,
    env,
    serviceSid,
    pkgJson,
    overrideExistingService: flags.overrideExistingProject,
    force: flags.force,
    serviceName,
    functionsEnv: flags.environment,
    functionsFolderName: flags.functionsFolder,
    assetsFolderName: flags.assetsFolder,
    noAssets: !flags.assets,
    noFunctions: !flags.functions,
    region,
    edge,
  };
}
