import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

interface AzureYml {
    tenant: string;
    fidalgo: Fidalgo;
}

interface Fidalgo {
    extension: string;
    project: FidalgoProject;
    catalog_item: string;
}

interface FidalgoProject {
    name: string;
    group: string;
}

async function run(): Promise<void> {
    try {
        const pattern = core.getInput('azure');

        core.info(`azure input: ${pattern}`);

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

        const globber = await glob.create(pattern);
        const files = await globber.glob();

        const file = files.length > 0 ? files[0] : undefined;

        if (file) {

            core.info(`Found azure.yml file: ${file}`);

            const contents = await fs.readFile(file, 'utf8');
            const azure = yaml.load(contents) as AzureYml;

            const tenantId = azure.tenant;

            if (tenantId) {
                core.info(`Found tenant id in azure.yml file: ${tenantId}`);
                core.setOutput('tenant', tenantId);
            } else {
                core.setFailed(`Could not tenant id from azure.yml: ${contents}`);
            }

            const fidalgoExt = azure.fidalgo.extension;

            if (fidalgoExt) {
                core.info(`Found fidalgo extension in azure.yml file: ${fidalgoExt}`);
                core.setOutput('fidalgo', fidalgoExt);
            } else {
                core.setFailed(`Could not get fidalgo extension from azure.yml: ${contents}`);
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

            // const context = JSON.stringify(github.context, undefined, 2);
            // core.info(`Context: ${context}`);
            // core.info(`Payload: ${payload}`);
        } else {
            core.setFailed(`Could not find azure.yml file with specified glob: ${pattern}`);
        }

        const account = await exec.getExecOutput('az', ['account', 'show', '--only-show-errors']);
        core.info(`az account show: ${account}`);

        // set config to auto install extensions without prompt
        await exec.exec('az', ['config', 'set', 'extension.use_dynamic_install=yes_without_prompt', '--only-show-errors']);


        const tenants_json = await exec.getExecOutput('az', ['account', 'tenant', 'list', '--only-show-errors']);
        core.info(`az account tenant list st: ${tenants_json}`);

        const tenants = JSON.parse(tenants_json.stdout) as [{ id: string, tenantId: string; }];
        core.info(`Found tenant: ${tenants[0].id}`);

    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

run();