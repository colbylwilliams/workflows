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

            const fidalgoExt = azure.fidalgo.project.name;

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

            const context = JSON.stringify(github.context, undefined, 2);
            core.info(`Context: ${context}`);
            // core.info(`Payload: ${payload}`);
        } else {
            core.setFailed(`Could not find azure.yml file with specified glob: ${pattern}`);
        }

        const account = exec.getExecOutput('az', ['account', 'show', '--output', 'json']);

        core.info(`az account show: ${account}`);

    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

run();