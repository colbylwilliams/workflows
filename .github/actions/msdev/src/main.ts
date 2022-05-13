import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

const DEVAULT_FIDALGO_EXTENSION = 'https://fidalgosetup.blob.core.windows.net/cli-extensions/fidalgo-0.3.2-py3-none-any.whl';

interface AzureYml {
    tenant?: string;
    fidalgo: Fidalgo;
}

interface Fidalgo {
    extension?: string;
    project: FidalgoProject;
    catalog_item: string;
}

interface FidalgoProject {
    name: string;
    group: string;
}

function getNameAndType(): { name: string, type: string; } {

    const context = github.context;

    const part_ref = context.eventName === 'pull_request' ? 'pr' : 'branch';
    const name_part = context.eventName === 'pull_request' ? context.issue.number : context.eventName === 'push' ? context.ref.split('/').slice(-1)[0] : context.ref;
    const suffix_part = context.payload.repository!['id'];

    const env_name = `ci-${part_ref}-${name_part}-${suffix_part}`;

    core.info(`Setting environment name: ${env_name}`);
    core.setOutput('name', env_name);

    let env_type = 'Dev';

    if (context.eventName === 'push') {
        env_type = context.payload.ref === 'refs/heads/main' ? 'Prod' : 'Dev';
    } else if (context.eventName === 'pull_request') {
        env_type = context.payload.pull_request?.base.ref == 'main' && 'Pre-Prod' || 'Test';
    }

    core.info(`Setting environment type: ${env_type}`);
    core.setOutput('type', env_type);

    return { name: env_name, type: env_type };
}

async function run(): Promise<void> {
    try {

        const name_and_type = getNameAndType();

        const pattern = core.getInput('azure');

        core.info(`azure input: ${pattern}`);

        const globber = await glob.create(pattern);
        const files = await globber.glob();

        const file = files.length > 0 ? files[0] : undefined;

        if (file) {

            core.info(`Found azure.yml file: ${file}`);

            const contents = await fs.readFile(file, 'utf8');
            const azure = yaml.load(contents) as AzureYml;

            // allow for override of tenant
            if (azure.tenant) {
                core.info(`Found tenant id in azure.yml file: ${azure.tenant}`);
                core.setOutput('tenant', azure.tenant);
            } else {
                // attempt to get tenant from azure using service principal
                core.info(`No tenant id found in azure.yml file, attempting to get from Azure`);

                // set config to auto install extensions without prompt
                await exec.exec('az', ['config', 'set', 'extension.use_dynamic_install=yes_without_prompt', '--only-show-errors']);

                const tenantsJson = await exec.getExecOutput('az', ['account', 'tenant', 'list', '--only-show-errors']);
                core.info(`az account tenant list: ${tenantsJson.stdout}`);

                const tenants = JSON.parse(tenantsJson.stdout) as [{ id: string, tenantId: string; }];
                // TODO: handle multiple tenants
                core.info(`Found tenant with id: ${tenants[0].tenantId}`);
                core.setOutput('tenant', tenants[0].tenantId);

                // core.setFailed(`Could not tenant id from azure.yml: ${contents}`);
            }

            // allow for override of extension
            if (azure.fidalgo.extension) {
                core.info(`Found fidalgo extension in azure.yml file: ${azure.fidalgo.extension}`);
                core.setOutput('fidalgo', azure.fidalgo.extension);
            } else {
                // use default extension
                core.info(`No fidalgo extension found in azure.yml file, using default: ${DEVAULT_FIDALGO_EXTENSION}`);
                core.setOutput('fidalgo', DEVAULT_FIDALGO_EXTENSION);
            }

            const projectName = azure.fidalgo.project.name;

            if (projectName) {
                core.info(`Found project name in azure.yml file: ${projectName}`);
                core.setOutput('project_name', projectName);
            } else {
                core.setFailed(`Could not get project name from azure.yml: ${contents}`);
            }

            const projectGroup = azure.fidalgo.project.group;

            if (projectGroup) {
                core.info(`Found project group in azure.yml file: ${projectGroup}`);
                core.setOutput('project_group', projectGroup);
            } else {
                core.setFailed(`Could not get project group from azure.yml: ${contents}`);
            }

            const catalogItem = azure.fidalgo.catalog_item;

            if (catalogItem) {
                core.info(`Found catalog item in azure.yml file: ${catalogItem}`);
                core.setOutput('catalog_item', catalogItem);
            } else {
                core.setFailed(`Could not get catalog item from azure.yml: ${contents}`);
            }
        } else {
            core.setFailed(`Could not find azure.yml file with specified glob: ${pattern}`);
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

run();