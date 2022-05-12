import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

interface AzureYml {
    tenant: string;
    fidalgo: Fidalgo;
}

interface Fidalgo {
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

        const globber = await glob.create(pattern);
        const files = await globber.glob();

        const file = files.length > 0 ? files[0] : undefined;

        if (file) {
            core.info(`Found azure.yml file: ${file}`);

            const contents = await fs.readFile(file, 'utf8');
            const data = yaml.load(contents) as AzureYml;

            const tenantId = data.fidalgo.project.name;

            if (tenantId) {
                core.info(`Found tenant id in azure.yml file: ${tenantId}`);
                core.setOutput('tenant', tenantId);
            } else {
                core.setFailed(`Could not tenant id from azure.yml: ${contents}`);
            }

            const projectName = data.fidalgo.project.name;

            if (projectName) {
                core.info(`Found project name in azure.yml file: ${projectName}`);
                core.setOutput('project_name', projectName);
            } else {
                core.setFailed(`Could not get project name from azure.yml: ${contents}`);
            }

            const projectGroup = data.fidalgo.project.group;

            if (projectGroup) {
                core.info(`Found project group in azure.yml file: ${projectGroup}`);
                core.setOutput('project_group', projectGroup);
            } else {
                core.setFailed(`Could not get project group from azure.yml: ${contents}`);
            }

            const catalogItem = data.fidalgo.catalog_item;

            if (catalogItem) {
                core.info(`Found catalog item in azure.yml file: ${catalogItem}`);
                core.setOutput('catalog_item', catalogItem);
            } else {
                core.setFailed(`Could not get catalog item from azure.yml: ${contents}`);
            }


        } else {
            core.setFailed(`Could not find azure.yml file with specified glob: ${pattern}`);
        }

        files.forEach(file => {
            core.info(`Found file: ${file}`);
        });

        // const ms: string = core.getInput('milliseconds');
        // core.debug(`Waiting ${ms} milliseconds ...`); // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true

        // core.debug(new Date().toTimeString());
        // await wait(parseInt(ms, 10));
        // core.debug(new Date().toTimeString());

        // core.setOutput('time', new Date().toTimeString());
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

run();