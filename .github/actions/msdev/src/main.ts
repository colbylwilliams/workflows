import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

interface AzureYml {
    fidalgo: AzureYmlFidalgo;

}

interface AzureYmlFidalgo {
    project: string;
    catalog_item: string;
}

async function run(): Promise<void> {
    try {
        const azureyml = core.getInput('azure');

        core.info(`azure input: ${azureyml}`);

        const globber = await glob.create(azureyml);
        const files = await globber.glob();

        const file = files.length > 0 ? files[0] : undefined;

        if (file) {
            core.info(`Found azure.yml file: ${file}`);

            const contents = await fs.readFile(file, 'utf8');

            const data = yaml.load(contents) as AzureYml;

            const project = data.fidalgo.project;

            if (project) {
                core.info(`Found project in azure.yml file: ${project}`);
                core.setOutput('project', project);
            } else {
                core.setFailed(`Could not get project from azure.yml: ${contents}`);
            }


        } else {
            core.setFailed(`Could not find azure.yml file with specified glob: ${azureyml}`);
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