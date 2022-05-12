import * as core from '@actions/core';
import * as glob from '@actions/glob';

async function run(): Promise<void> {
    try {
        const azureyml = core.getInput('azure');

        core.info(`azure input: ${azureyml}`);

        const globber = await glob.create(azureyml);
        const files = await globber.glob();

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